provider "yandex" {
  token     = var.yc_token
  cloud_id  = var.yc_cloud_id
  folder_id = var.yc_folder_id
  zone      = var.yc_zone
}

# yandex_storage_object cannot set Cache-Control, so the site objects go through the
# S3-compatible API instead. Same bucket, same key set, only the upload path differs.
provider "aws" {
  alias                       = "storage"
  region                      = "ru-central1"
  access_key                  = yandex_iam_service_account_static_access_key.site_deployer.access_key
  secret_key                  = yandex_iam_service_account_static_access_key.site_deployer.secret_key
  skip_region_validation      = true
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true

  endpoints {
    s3 = "https://storage.yandexcloud.net"
  }
}
