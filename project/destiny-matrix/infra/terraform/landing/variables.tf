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
  description = "Landing FQDN without a trailing dot. Also the bucket name."
  default     = "arcana-sense.com"
}

variable "dns_zone_name" {
  type        = string
  description = "Name of the Cloud DNS zone resource created by this root."
  default     = "arcana-sense-com"
}

# Сертификат Certificate Manager проверяется CNAME-записью в самой зоне, поэтому домен обязан
# быть делегирован на ns1/ns2.yandexcloud.net до того, как ждать статус ISSUED.
variable "enable_https" {
  type        = bool
  description = "Attach the managed certificate to the bucket. Turn on only after the certificate reports ISSUED."
  default     = false
}

variable "enable_cdn" {
  type        = bool
  description = "Put Cloud CDN in front of the bucket. Not needed for one page: adds a fixed monthly fee."
  default     = false
}

variable "content_dir" {
  type        = string
  description = "Directory with the landing files, relative to this root."
  default     = "../../landing"
}

variable "max_size_bytes" {
  type        = number
  description = "Bucket quota. A landing page fits in single-digit megabytes; the quota is the cheap stop against an unbounded bill."
  default     = 67108864
}
