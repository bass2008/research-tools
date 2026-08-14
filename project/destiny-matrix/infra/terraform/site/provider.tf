provider "yandex" {
  token     = var.yc_token
  cloud_id  = var.yc_cloud_id
  folder_id = var.yc_folder_id
  zone      = var.yc_zone
}

# Configured only for the optional Terraform-managed upload (var.manage_objects). The recommended
# path is ./deploy.sh, which syncs the directory outside the graph — see ../README.md.
provider "aws" {
  alias                       = "storage"
  region                      = "ru-central1"
  access_key                  = module.site.deploy_access_key
  secret_key                  = module.site.deploy_secret_key
  skip_region_validation      = true
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true

  endpoints {
    s3 = "https://storage.yandexcloud.net"
  }
}
