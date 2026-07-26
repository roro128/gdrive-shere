variable "google_bootstrap_project_id" {
  description = "Existing Google Cloud project used to create the application project."
  type        = string
}

variable "google_project_id" {
  description = "Globally unique ID for the new Google Cloud project."
  type        = string
}

variable "google_project_name" {
  description = "Display name for the new Google Cloud project."
  type        = string
  default     = "GDrive Share"
}

variable "google_billing_account" {
  description = "Billing account ID. Leave empty when the account does not require billing for the test."
  type        = string
  default     = ""
}

variable "google_parent_folder_id" {
  description = "Optional Google Cloud folder ID."
  type        = string
  default     = ""
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID."
  type        = string
}

variable "worker_name" {
  description = "Cloudflare Worker name."
  type        = string
  default     = "gdrive-share"
}

variable "d1_database_name" {
  description = "Cloudflare D1 database name."
  type        = string
  default     = "gdrive-share"
}
