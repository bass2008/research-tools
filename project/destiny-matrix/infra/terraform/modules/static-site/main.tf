locals {
  bucket = coalesce(var.bucket_name, var.domain)
  sa_name = coalesce(
    var.service_account_name,
    substr(replace(var.domain, ".", "-"), 0, 58)
  )

  website_endpoint = "${local.bucket}.website.yandexcloud.net"

  # Path-style address of the bucket over the shared storage certificate. Works without owning the
  # domain and without a certificate of our own — this is what assetPrefix can point at.
  asset_base_url = "https://storage.yandexcloud.net/${local.bucket}"

  # Serving straight from the bucket needs the certificate on the bucket; behind CDN it lives on the
  # CDN resource and the bucket keeps talking plain HTTP to the edge over Yandex's internal network.
  bucket_https = var.enable_https && !var.enable_cdn && var.manage_certificate

  cname_target = var.enable_cdn ? "${yandex_cdn_resource.site[0].provider_cname}." : "${local.website_endpoint}."
}

resource "yandex_iam_service_account" "deployer" {
  folder_id   = var.folder_id
  name        = "${local.sa_name}-deploy"
  description = "Uploads the static assets of ${var.domain}"
}

# Creating a bucket needs storage.admin; object-only roles cannot do it. The grant is folder-wide
# because Object Storage has no per-bucket IAM — narrow it with a bucket policy if the folder grows.
resource "yandex_resourcemanager_folder_iam_member" "deployer_storage" {
  folder_id = var.folder_id
  role      = "storage.admin"
  member    = "serviceAccount:${yandex_iam_service_account.deployer.id}"
}

resource "yandex_iam_service_account_static_access_key" "deployer" {
  service_account_id = yandex_iam_service_account.deployer.id
  description        = "S3 credentials for deploying ${var.domain}"
}

resource "yandex_storage_bucket" "site" {
  folder_id  = var.folder_id
  bucket     = local.bucket
  access_key = yandex_iam_service_account_static_access_key.deployer.access_key
  secret_key = yandex_iam_service_account_static_access_key.deployer.secret_key

  max_size      = var.max_size_bytes
  force_destroy = false

  anonymous_access_flags {
    read        = true
    list        = false
    config_read = false
  }

  website {
    index_document = var.index_document
    error_document = var.error_document
  }

  dynamic "https" {
    for_each = local.bucket_https ? [1] : []
    content {
      certificate_id = yandex_cm_certificate.site[0].id
    }
  }

  depends_on = [yandex_resourcemanager_folder_iam_member.deployer_storage]
}

# Needed only while the bucket itself answers on var.domain. With the site served by node on the VM
# the domain carries an A record and TLS comes from certbot, so the managed certificate is off.
resource "yandex_cm_certificate" "site" {
  count = var.manage_certificate ? 1 : 0

  folder_id   = var.folder_id
  name        = local.sa_name
  description = "Managed TLS certificate for ${var.domain}"
  domains     = [var.domain]
  labels      = var.labels

  managed {
    challenge_type = "DNS_CNAME"
  }
}

resource "yandex_dns_recordset" "certificate_validation" {
  count = var.manage_certificate ? 1 : 0

  zone_id = var.dns_zone_id
  name    = yandex_cm_certificate.site[0].challenges[0].dns_name
  type    = yandex_cm_certificate.site[0].challenges[0].dns_type
  data    = [yandex_cm_certificate.site[0].challenges[0].dns_value]
  ttl     = var.dns_ttl
}

# A CNAME and an A record cannot coexist on the same name. The VM owns var.domain now, so this
# record is created only when the bucket is the one serving the site.
resource "yandex_dns_recordset" "site" {
  count = var.manage_dns ? 1 : 0

  zone_id = var.dns_zone_id
  name    = "${var.domain}."
  type    = "CNAME"
  data    = [local.cname_target]
  ttl     = var.dns_ttl
}

resource "yandex_cdn_origin_group" "site" {
  count = var.enable_cdn ? 1 : 0

  folder_id = var.folder_id
  name      = "${local.sa_name}-origin"
  use_next  = true

  origin {
    source  = local.website_endpoint
    enabled = true
  }
}

# CDN in front of the bucket claims var.domain as its cname, so it only makes sense together with
# manage_dns. A CDN in front of the node server would be a different resource with the VM as origin.
resource "yandex_cdn_resource" "site" {
  count = var.enable_cdn ? 1 : 0

  folder_id       = var.folder_id
  cname           = var.domain
  origin_group_id = yandex_cdn_origin_group.site[0].id
  origin_protocol = "http"
  active          = true
  labels          = var.labels

  options {
    gzip_on                = true
    redirect_http_to_https = true
    ignore_cookie          = true

    # The bucket routes by Host, so the edge must send the endpoint name, not the site domain.
    forward_host_header = false
    custom_host_header  = local.website_endpoint
  }

  dynamic "ssl_certificate" {
    for_each = var.enable_https && var.manage_certificate ? [1] : []
    content {
      type                   = "certificate_manager"
      certificate_manager_id = yandex_cm_certificate.site[0].id
    }
  }
}
