locals {
  # Without Cache-Control a browser picks heuristic freshness from Last-Modified and can serve an
  # old copy for hours. That kept a pre-HTTPS response alive after the certificate was attached.
  # The files carry no content hash in their names, so revalidation must be unconditional.
  site_cache_control = "no-cache"

  site_dir = "${path.module}/site"

  site_files = {
    "index.html" = {
      source       = "${local.site_dir}/index.html"
      content_type = "text/html; charset=utf-8"
    }
    "styles.css" = {
      source       = "${local.site_dir}/styles.css"
      content_type = "text/css; charset=utf-8"
    }
    "script.js" = {
      source       = "${local.site_dir}/script.js"
      content_type = "application/javascript; charset=utf-8"
    }
    "favicon.svg" = {
      source       = "${local.site_dir}/favicon.svg"
      content_type = "image/svg+xml"
    }
  }
}

resource "yandex_iam_service_account" "site_deployer" {
  folder_id   = var.yc_folder_id
  name        = "webstudiolab-site"
  description = "Uploads the Web Studio Lab static website"
}

resource "yandex_resourcemanager_folder_iam_member" "site_storage" {
  folder_id = var.yc_folder_id
  role      = "storage.admin"
  member    = "serviceAccount:${yandex_iam_service_account.site_deployer.id}"
}

resource "yandex_iam_service_account_static_access_key" "site_deployer" {
  service_account_id = yandex_iam_service_account.site_deployer.id
  description        = "Object Storage key for the Web Studio Lab site"
}

resource "yandex_storage_bucket" "site" {
  folder_id  = var.yc_folder_id
  bucket     = var.site_bucket_name
  access_key = yandex_iam_service_account_static_access_key.site_deployer.access_key
  secret_key = yandex_iam_service_account_static_access_key.site_deployer.secret_key

  max_size      = 1073741824
  force_destroy = false

  anonymous_access_flags {
    read        = true
    list        = false
    config_read = false
  }

  website {
    index_document = "index.html"
    error_document = "index.html"
  }

  dynamic "https" {
    for_each = var.enable_https ? [1] : []
    content {
      certificate_id = yandex_cm_certificate.site.id
    }
  }

  depends_on = [yandex_resourcemanager_folder_iam_member.site_storage]
}

resource "aws_s3_object" "site" {
  provider = aws.storage
  for_each = local.site_files

  bucket        = yandex_storage_bucket.site.id
  key           = each.key
  source        = each.value.source
  content_type  = each.value.content_type
  cache_control = local.site_cache_control
  etag          = filemd5(each.value.source)

  depends_on = [yandex_resourcemanager_folder_iam_member.site_storage]
}
