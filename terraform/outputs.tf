output "google_project_id" {
  value = google_project.app.project_id
}

output "google_drive_api_key" {
  value     = google_apikeys_key.drive.key_string
  sensitive = true
}

output "cloudflare_d1_database_id" {
  value = cloudflare_d1_database.app.id
}

output "worker_name" {
  value = cloudflare_worker.app.name
}
