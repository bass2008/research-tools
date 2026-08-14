output "bucket_name" {
  description = "Object Storage bucket that holds the assets."
  value       = yandex_storage_bucket.site.bucket
}

output "website_endpoint" {
  description = "Direct Object Storage website endpoint, reachable before DNS and TLS are ready."
  value       = local.website_endpoint
}

output "asset_base_url" {
  description = "HTTPS prefix of the bucket that needs no certificate and no domain of its own. Candidate for next.config assetPrefix."
  value       = local.asset_base_url
}

output "site_url" {
  description = "Where the bucket content is reachable. Not the site itself once the domain points at the VM."
  value       = var.manage_dns ? (var.enable_https ? "https://${var.domain}" : "http://${var.domain}") : local.asset_base_url
}

output "dns_record" {
  description = "Site record created by this module, empty when the domain is served elsewhere."
  value       = var.manage_dns ? "${yandex_dns_recordset.site[0].name} CNAME ${local.cname_target}" : ""
}

output "certificate_id" {
  description = "Managed certificate ID, empty when the certificate is off."
  value       = var.manage_certificate ? yandex_cm_certificate.site[0].id : ""
}

output "certificate_status_command" {
  description = "Run until the status becomes ISSUED, then apply with enable_https=true."
  value       = var.manage_certificate ? "yc certificate-manager certificate get --id ${yandex_cm_certificate.site[0].id}" : ""
}

output "cdn_resource_id" {
  description = "CDN resource ID, or an empty string when the CDN is off."
  value       = var.enable_cdn ? yandex_cdn_resource.site[0].id : ""
}

output "deploy_access_key" {
  description = "Static access key for uploading objects."
  value       = yandex_iam_service_account_static_access_key.deployer.access_key
  sensitive   = true
}

output "deploy_secret_key" {
  description = "Static secret key for uploading objects."
  value       = yandex_iam_service_account_static_access_key.deployer.secret_key
  sensitive   = true
}
