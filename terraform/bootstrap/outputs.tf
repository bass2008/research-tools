output "state_bucket_name" {
  description = "Bucket name referenced by the other Terraform roots."
  value       = yandex_storage_bucket.terraform_state.bucket
}

output "state_access_key" {
  description = "S3 access key for Terraform backends."
  value       = yandex_iam_service_account_static_access_key.terraform_state.access_key
  sensitive   = true
}

output "state_secret_key" {
  description = "S3 secret key for Terraform backends."
  value       = yandex_iam_service_account_static_access_key.terraform_state.secret_key
  sensitive   = true
}
