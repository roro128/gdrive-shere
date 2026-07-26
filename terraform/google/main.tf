provider "google" {
  project = var.google_bootstrap_project_id
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
    "cloudresourcemanager.googleapis.com",
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
