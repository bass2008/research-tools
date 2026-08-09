variable "yc_token" {
  type        = string
  description = "Yandex Cloud IAM token. The shell function tf exports TF_VAR_yc_token."
  sensitive   = true
}

variable "yc_cloud_id" {
  type        = string
  description = "Yandex Cloud cloud ID."
}

variable "yc_folder_id" {
  type        = string
  description = "Yandex Cloud folder ID."
}

variable "yc_zone" {
  type        = string
  description = "Default availability zone."
  default     = "ru-central1-a"
}

variable "state_bucket_name" {
  type        = string
  description = "Globally unique Object Storage bucket used only for Terraform state."
  default     = "webstudiolab-ru-tfstate-hjb4rfs"
}

variable "state_service_account_name" {
  type        = string
  description = "Service account used by Terraform S3 backends."
  default     = "webstudiolab-tfstate"
}
