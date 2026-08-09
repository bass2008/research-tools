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
  description = "Default availability zone for the provider."
  default     = "ru-central1-a"
}

variable "domain" {
  type        = string
  description = "Public website and mail domain without a trailing dot."
  default     = "webstudiolab.ru"
}

variable "site_bucket_name" {
  type        = string
  description = "Object Storage bucket. It must equal the custom HTTPS domain."
  default     = "webstudiolab.ru"
}

variable "enable_https" {
  type        = bool
  description = "Attach the managed certificate after the domain is delegated and the certificate is ISSUED."
  default     = false
}
