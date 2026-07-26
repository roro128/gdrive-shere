provider "google" {
  project = var.google_bootstrap_project_id
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token (not a Wrangler OAuth token) with Workers Scripts Edit, D1 Edit, and account read permissions."
  type        = string
  sensitive   = true
}

resource "google_project" "app" {
  project_id      = var.google_project_id
  name            = var.google_project_name
  billing_account = var.google_billing_account != "" ? var.google_billing_account : null
  folder_id       = var.google_parent_folder_id != "" ? var.google_parent_folder_id : null
  deletion_policy = "DELETE"
}

resource "google_project_service" "required" {
  for_each = toset([
    "drive.googleapis.com",
    "apikeys.googleapis.com",
    "serviceusage.googleapis.com"
  ])

  project            = google_project.app.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_apikeys_key" "drive" {
  name         = "gdrive-share-drive"
  project      = google_project.app.project_id
  display_name = "GDrive Share Drive API"

  restrictions {
    api_targets {
      service = "drive.googleapis.com"
    }
  }

  depends_on = [google_project_service.required]
}

resource "cloudflare_d1_database" "app" {
  account_id = var.cloudflare_account_id
  name       = var.d1_database_name
}

resource "cloudflare_worker" "app" {
  account_id = var.cloudflare_account_id
  name       = var.worker_name
  observability = {
    enabled = true
  }
  subdomain = {
    enabled          = true
    previews_enabled = false
  }
}
