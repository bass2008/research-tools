variable "folder_id" {
  type        = string
  description = "Yandex Cloud folder that owns the bucket, the certificate and the CDN resource."
}

variable "domain" {
  type        = string
  description = "Public FQDN of the site without a trailing dot, e.g. arcana-sense.ru."

  validation {
    condition     = !endswith(var.domain, ".") && length(split(".", var.domain)) >= 2
    error_message = "domain must be a bare FQDN without a trailing dot."
  }
}

variable "dns_zone_id" {
  type        = string
  description = "ID of an existing Cloud DNS zone that contains var.domain. The module never manages the zone itself."
}

variable "bucket_name" {
  type        = string
  description = "Object Storage bucket name. Must equal var.domain while the site is served straight from the website endpoint over HTTPS."
  default     = null
}

variable "service_account_name" {
  type        = string
  description = "Name of the deploy service account. Defaults to the domain with dots replaced by hyphens."
  default     = null
}

variable "manage_dns" {
  type        = bool
  description = "Create the CNAME that points var.domain at the bucket. Must stay false while a VM serves the domain: a CNAME cannot coexist with the A record."
  default     = true
}

variable "manage_certificate" {
  type        = bool
  description = "Create the Certificate Manager certificate for var.domain. Needed only when the bucket or the CDN terminates TLS for the domain."
  default     = true
}

variable "enable_https" {
  type        = bool
  description = "Attach the managed certificate. Turn on only after Certificate Manager reports ISSUED."
  default     = false
}

variable "enable_cdn" {
  type        = bool
  description = "Put Cloud CDN in front of the bucket. Adds a fixed monthly fee per CDN resource, see the README cost table."
  default     = false
}

variable "index_document" {
  type        = string
  description = "Key returned for a directory-style request."
  default     = "index.html"
}

variable "error_document" {
  type        = string
  description = "Key returned for a missing object."
  default     = "404.html"
}

variable "max_size_bytes" {
  type        = number
  description = "Bucket quota. Uploads over the quota get 403, which is cheaper than an unbounded bill."
  default     = 1073741824
}

variable "dns_ttl" {
  type        = number
  description = "TTL of the site and validation records."
  default     = 300
}

variable "labels" {
  type        = map(string)
  description = "Labels applied to the resources that support them."
  default     = {}
}
