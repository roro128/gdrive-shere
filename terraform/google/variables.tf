variable "google_bootstrap_project_id" {
  description = "Existing project used by Terraform credentials to create the application project."
  type        = string
}

variable "google_project_id" {
  description = "Globally unique ID for the new Google Cloud project."
  type        = string
}

variable "google_project_name" {
  description = "Display name of the new Google Cloud project."
  type        = string
  default     = "GDrive Share"
}

variable "google_billing_account" {
  description = "Billing account ID attached to the new project."
  type        = string
  default     = ""
}

variable "google_parent_folder_id" {
  description = "Optional Google Cloud folder ID."
  type        = string
  default     = ""
}
