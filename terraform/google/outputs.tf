output "google_project_id" {
  value = google_project.app.project_id
}

output "google_drive_api_key" {
  value     = google_apikeys_key.drive.key_string
  sensitive = true
}
