#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
GOOGLE_TERRAFORM_DIR="$REPO_DIR/terraform/google"
WORKER_ORIGIN="${WORKER_ORIGIN:-https://gdrive-share.codo.workers.dev}"
GOOGLE_CREDENTIALS_PATH=""
SKIP_TERRAFORM=0
SKIP_DEPLOY=0

usage() {
  cat <<'EOF'
Usage: ./scripts/bootstrap-google-admin.sh [options]

Options:
  --google-credentials PATH  Use a Google service-account JSON file.
  --worker-origin URL        Worker origin (default: workers.dev URL).
  --skip-terraform           Skip Terraform init/apply.
  --skip-deploy              Skip bun run deploy.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --google-credentials)
      GOOGLE_CREDENTIALS_PATH="$2"
      shift 2
      ;;
    --worker-origin)
      WORKER_ORIGIN="$2"
      shift 2
      ;;
    --skip-terraform)
      SKIP_TERRAFORM=1
      shift
      ;;
    --skip-deploy)
      SKIP_DEPLOY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing command: $1" >&2
    exit 1
  }
}

require_command terraform
require_command bun

if [[ -n "$GOOGLE_CREDENTIALS_PATH" ]]; then
  [[ -f "$GOOGLE_CREDENTIALS_PATH" ]] || {
    echo "Google credentials JSON not found: $GOOGLE_CREDENTIALS_PATH" >&2
    exit 1
  }
  export GOOGLE_APPLICATION_CREDENTIALS="$(cd -- "$(dirname -- "$GOOGLE_CREDENTIALS_PATH")" && pwd)/$(basename -- "$GOOGLE_CREDENTIALS_PATH")"
elif [[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]] && ! command -v gcloud >/dev/null 2>&1; then
  echo "Install gcloud or pass --google-credentials PATH." >&2
  exit 1
fi

if [[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]] && command -v gcloud >/dev/null 2>&1; then
  if ! gcloud auth list --format='value(account)' 2>/dev/null | grep -q .; then
    echo 'No active gcloud account; opening the Google OAuth browser.'
    gcloud auth login
  fi
  if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then
    echo 'No ADC credentials; opening the ADC OAuth browser.'
    gcloud auth application-default login
  fi
fi

if [[ "$SKIP_TERRAFORM" -eq 0 ]]; then
  TERRAFORM_ARGS=()
  if [[ -f "$GOOGLE_TERRAFORM_DIR/terraform.tfvars" ]]; then
    TERRAFORM_ARGS+=("-var-file=terraform.tfvars")
  else
    echo 'terraform.tfvars not found; querying gcloud for defaults.'
    BOOTSTRAP_DEFAULT="$(gcloud config get-value project 2>/dev/null || true)"
    if [[ -z "$BOOTSTRAP_DEFAULT" || "$BOOTSTRAP_DEFAULT" == "(unset)" ]]; then
      BOOTSTRAP_DEFAULT="$(gcloud projects list --format='value(projectId)' 2>/dev/null | head -n 1 || true)"
    fi
    PROJECT_ID_DEFAULT="gdrive-share-$(date -u +%Y%m%d%H%M%S)"
    BILLING_DEFAULT="$(gcloud billing accounts list --filter='open=true' --format='value(name)' 2>/dev/null | head -n 1 || true)"
    read -r -p "Existing Google bootstrap project ID [$BOOTSTRAP_DEFAULT]: " BOOTSTRAP_PROJECT
    read -r -p "New globally unique Google project ID [$PROJECT_ID_DEFAULT]: " PROJECT_ID_INPUT
    read -r -p 'Project display name [GDrive Share]: ' PROJECT_NAME_INPUT
    read -r -p "Billing account ID [$BILLING_DEFAULT]: " BILLING_ACCOUNT_INPUT
    read -r -p 'Parent folder ID (optional): ' PARENT_FOLDER_INPUT
    BOOTSTRAP_PROJECT="${BOOTSTRAP_PROJECT:-$BOOTSTRAP_DEFAULT}"
    PROJECT_ID_INPUT="${PROJECT_ID_INPUT:-$PROJECT_ID_DEFAULT}"
    BILLING_ACCOUNT_INPUT="${BILLING_ACCOUNT_INPUT:-$BILLING_DEFAULT}"
    [[ -n "$BOOTSTRAP_PROJECT" && -n "$PROJECT_ID_INPUT" ]] || {
      echo 'Bootstrap project ID and new project ID are required.' >&2
      exit 1
    }
    PROJECT_NAME_INPUT="${PROJECT_NAME_INPUT:-GDrive Share}"
    TERRAFORM_ARGS+=("-var=google_bootstrap_project_id=$BOOTSTRAP_PROJECT")
    TERRAFORM_ARGS+=("-var=google_project_id=$PROJECT_ID_INPUT")
    TERRAFORM_ARGS+=("-var=google_project_name=$PROJECT_NAME_INPUT")
    TERRAFORM_ARGS+=("-var=google_billing_account=$BILLING_ACCOUNT_INPUT")
    TERRAFORM_ARGS+=("-var=google_parent_folder_id=$PARENT_FOLDER_INPUT")
  fi
  terraform -chdir="$GOOGLE_TERRAFORM_DIR" init
  terraform -chdir="$GOOGLE_TERRAFORM_DIR" apply -auto-approve "${TERRAFORM_ARGS[@]}"
fi

API_KEY="$(terraform -chdir="$GOOGLE_TERRAFORM_DIR" output -raw google_drive_api_key)"
PROJECT_ID="$(terraform -chdir="$GOOGLE_TERRAFORM_DIR" output -raw google_project_id)"
echo "Google Cloud project ready: $PROJECT_ID"

set_worker_secret() {
  local name="$1"
  local value="$2"
  [[ -n "$value" ]] || { echo "$name is empty." >&2; exit 1; }
  printf '%s' "$value" | bunx wrangler secret put "$name" >/dev/null
}

set_worker_secret GOOGLE_API_KEY "$API_KEY"
read -r -p "Google Web OAuth Client ID: " CLIENT_ID
CLIENT_ID="${CLIENT_ID#$'\ufeff'}"
CLIENT_ID="$(printf '%s' "$CLIENT_ID" | sed 's/[[:space:]]*$//')"
read -r -s -p "Google Web OAuth Client Secret: " CLIENT_SECRET
CLIENT_SECRET="${CLIENT_SECRET#$'\ufeff'}"
printf '\n'
read -r -p "Allowed Google admin email(s), comma-separated: " ADMIN_EMAILS
ADMIN_EMAILS="${ADMIN_EMAILS#$'\ufeff'}"
[[ -n "$ADMIN_EMAILS" ]] || { echo "Allowed Google admin email is required." >&2; exit 1; }
set_worker_secret GOOGLE_CLIENT_ID "$CLIENT_ID"
set_worker_secret GOOGLE_CLIENT_SECRET "$CLIENT_SECRET"
set_worker_secret GOOGLE_ADMIN_EMAILS "$ADMIN_EMAILS"

if [[ "$SKIP_DEPLOY" -eq 0 ]]; then
  (cd -- "$REPO_DIR" && bun run deploy)
fi

echo
echo "Register these Google OAuth redirect URIs:"
echo "$WORKER_ORIGIN/api/auth/google/callback"
echo "Open: $WORKER_ORIGIN/setup"

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$WORKER_ORIGIN/setup" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "$WORKER_ORIGIN/setup"
fi
