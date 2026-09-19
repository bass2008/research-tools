terraform {
  backend "s3" {
    endpoints = {
      s3 = "https://04db91244d8beed7741e3d47759db9fb.r2.cloudflarestorage.com"
    }

    bucket = "arcana-backups"
    region = "auto"
    key    = "tfstate/matritsa/landing/terraform.tfstate"

    skip_region_validation      = true
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}
