resource "yandex_iam_service_account" "terraform_state" {
  folder_id   = var.yc_folder_id
  name        = var.state_service_account_name
  description = "Access to the Arcana Sense Terraform state bucket"
}

resource "yandex_resourcemanager_folder_iam_member" "terraform_state_storage" {
  folder_id = var.yc_folder_id
  role      = "storage.admin"
  member    = "serviceAccount:${yandex_iam_service_account.terraform_state.id}"
}

resource "yandex_iam_service_account_static_access_key" "terraform_state" {
  service_account_id = yandex_iam_service_account.terraform_state.id
  description        = "S3 credentials for the Arcana Sense Terraform backend"
}

resource "yandex_storage_bucket" "terraform_state" {
  folder_id  = var.yc_folder_id
  bucket     = var.state_bucket_name
  access_key = yandex_iam_service_account_static_access_key.terraform_state.access_key
  secret_key = yandex_iam_service_account_static_access_key.terraform_state.secret_key

  force_destroy = false

  versioning {
    enabled = true
  }

  # состояние terraform: случайный destroy этого бакета уносит карту всей инфраструктуры
  lifecycle {
    prevent_destroy = true
  }

  depends_on = [yandex_resourcemanager_folder_iam_member.terraform_state_storage]
}
