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
  description = "Site FQDN without a trailing dot. Also the bucket name."
  default     = "arcana-sense.ru"
}

variable "dns_zone_name" {
  type        = string
  description = "Name of the existing Cloud DNS zone resource, created by terraform/arcana-sense.ru."
  default     = "arcana-sense-ru"
}

variable "manage_dns" {
  type        = bool
  description = "Point the domain at the bucket. False in the node layout: the domain carries an A record to the VM, and a CNAME cannot coexist with it."
  default     = false
}

variable "enable_https" {
  type        = bool
  description = "Terminate TLS for the domain on the bucket. Meaningful only with manage_dns; with node in front TLS comes from certbot."
  default     = false
}

variable "enable_cdn" {
  type        = bool
  description = "Put Cloud CDN in front of the bucket. Requires manage_dns, off is cheaper below roughly 250 GB of egress a month."
  default     = false
}

variable "content_dir" {
  type        = string
  description = "Directory with files to upload, relative to this root. Used by var.manage_objects only."
  default     = "../../../web/.next/static"
}

variable "object_key_prefix" {
  type        = string
  description = "Prefix prepended to every key uploaded from var.content_dir. Must end with a slash or be empty."
  default     = "_next/static/"

  validation {
    condition     = var.object_key_prefix == "" || endswith(var.object_key_prefix, "/")
    error_message = "object_key_prefix must be empty or end with a slash."
  }
}

variable "manage_objects" {
  type        = bool
  description = "Upload every file of var.content_dir as an aws_s3_object. Off by default: assets are deployed by ./deploy.sh."
  default     = false
}
