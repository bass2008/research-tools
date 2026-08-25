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
  description = "Availability zone of the VM and its subnet."
  default     = "ru-central1-a"
}

variable "site_domain" {
  type        = string
  description = "Domain of the site. This VM serves it: node behind nginx. The API host is api.<site_domain>."
  default     = "arcana-sense.ru"
}

variable "dns_zone_name" {
  type        = string
  description = "Name of the existing Cloud DNS zone resource, created by terraform/arcana-sense.ru."
  default     = "arcana-sense-ru"
}

variable "ssh_public_key" {
  type        = string
  description = "Public key installed for the ubuntu user. Read from a file in terraform.tfvars."
}

variable "ssh_allowed_cidrs" {
  type        = list(string)
  description = "Sources allowed to reach port 22. Narrow it to your address once the box is up. Deploy goes over ssh, so it cannot be closed entirely."
  default     = ["0.0.0.0/0"]
}

variable "admin_email" {
  type        = string
  description = "Address Let's Encrypt uses for expiry warnings."
}

variable "platform_id" {
  type        = string
  description = "standard-v2 is the only platform with a 5% vCPU level; standard-v3 (Ice Lake) starts at 20% but is cheaper per core above it."
  default     = "standard-v2"
}

variable "cores" {
  type        = number
  description = "vCPU count. Both burstable levels require at least 2."
  default     = 2
}

variable "core_fraction" {
  type        = number
  description = "Guaranteed share of a physical core. 5 on standard-v2, 20 on standard-v3. Pages are prerendered, so the box mostly copies bytes."
  default     = 5
}

variable "memory" {
  type        = number
  description = "RAM in GB. Measured need of the three services is about 1 GB; the rest is page cache for the prerendered tree. See ../README.md §4."
  default     = 2
}

variable "disk_type" {
  type        = string
  description = "network-ssd, not network-hdd: 5 544 prerendered pages are read cold by crawlers, and an HDD of this size gets a fraction of 300 IOPS per 256 GB unit."
  default     = "network-ssd"
}

variable "disk_size" {
  type        = number
  description = "Boot disk size in GB. Measured: OS ~4 + release 1,2 ГБ × releases_keep + Postgres + logs."
  default     = 20
}

variable "image_family" {
  type        = string
  description = "Image family in the standard-images folder."
  default     = "ubuntu-2404-lts"
}

# Конкретный образ, а не «последний из семейства». С family Яндекс обновляет образ раз в неделю,
# terraform видит новый id и требует ЗАМЕНИТЬ машину — то есть снести диск с базой. Обновление
# образа теперь осознанное действие: поменять это значение и применить.
variable "image_id" {
  type        = string
  default     = "fd8n7088reip5bg4dn09" # ubuntu-24-04-lts-v20260824
  description = "Boot image id. Pinned on purpose: see the comment above."
}

variable "swap_size_mb" {
  type        = number
  description = "Swap file size. Insurance against the OOM killer taking node or Postgres on a 2 GB box; 0 disables it."
  default     = 1024
}

variable "subnet_cidr" {
  type        = string
  description = "IPv4 range of the single subnet."
  default     = "10.10.0.0/24"
}

variable "postbox_identity" {
  type        = string
  description = "Postbox identity id: the DKIM CNAME records are named after it."
  default     = "egt9t0234kcdnqq4953i"
}

variable "backup_bucket" {
  type        = string
  description = "Bucket for database dumps; each product keeps its own prefix inside."
  default     = "db-backups-hjb4rfs"
}

variable "reports_bucket" {
  type        = string
  description = "Bucket for generated report PDFs."
  default     = "arcana-reports-hjb4rfs"
}
