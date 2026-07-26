#!/usr/bin/env bash
set -Eeuo pipefail

SKIP_LOGIN=0
INSTALL_DIR="${HOME}/.local/google-cloud-sdk"

usage() {
  cat <<'EOF'
Usage: ./scripts/install-google-cloud-cli.sh [options]

Options:
  --skip-login       Install only; do not start ADC login.
  --install-dir PATH Installation directory.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-login) SKIP_LOGIN=1; shift ;;
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 1; }
}

require_command curl
require_command tar

if command -v gcloud >/dev/null 2>&1; then
  echo 'Google Cloud CLI is already installed.'
else
  OS="$(uname -s)"
  ARCH="$(uname -m)"
  case "$OS:$ARCH" in
    Linux:x86_64) PACKAGE='google-cloud-cli-linux-x86_64.tar.gz' ;;
    Linux:aarch64|Linux:arm64) PACKAGE='google-cloud-cli-linux-arm.tar.gz' ;;
    Darwin:x86_64) PACKAGE='google-cloud-cli-darwin-x86_64.tar.gz' ;;
    Darwin:arm64) PACKAGE='google-cloud-cli-darwin-arm.tar.gz' ;;
    *) echo "Unsupported platform: $OS/$ARCH" >&2; exit 1 ;;
  esac

  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  curl --fail --location --silent --show-error \
    "https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/$PACKAGE" \
    --output "$TMP_DIR/$PACKAGE"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  tar -xzf "$TMP_DIR/$PACKAGE" -C "$TMP_DIR"
  rm -rf "$INSTALL_DIR"
  mv "$TMP_DIR/google-cloud-sdk" "$INSTALL_DIR"
  "$INSTALL_DIR/install.sh" --quiet --path-update=false --command-completion=false
fi

export PATH="$INSTALL_DIR/bin:$PATH"
gcloud --version

if [[ "$SKIP_LOGIN" -eq 0 ]]; then
  gcloud auth application-default login
fi

echo 'Google Cloud CLI setup complete.'
