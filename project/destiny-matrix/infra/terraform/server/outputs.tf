output "ip" {
  description = "Public address of the VM. DNS A records already point here."
  value       = yandex_vpc_address.app.external_ipv4_address[0].address
}

output "site_url" {
  description = "Site address. Works once the domain is delegated to ns1/ns2.yandexcloud.net."
  value       = "https://${var.site_domain}"
}

output "registry_id" {
  description = "Container registry the VM pulls images from."
  value       = yandex_container_registry.app.id
}

output "ssh" {
  description = "Administrative access."
  value       = "ssh ubuntu@${yandex_vpc_address.app.external_ipv4_address[0].address}"
}

output "zone_nameservers" {
  description = "Set these at the domain registrar, otherwise the zone is never asked anything."
  value       = ["ns1.yandexcloud.net", "ns2.yandexcloud.net"]
}

output "monthly_cost_rub" {
  description = "Street price estimate for the VM, disk and address (rubles with VAT)."
  value = format(
    "%.0f ₽/мес: vCPU %d×%d%% + RAM %d ГБ + %s %d ГБ + адрес",
    (var.cores * local.price_vcpu + var.memory * local.price_ram + var.disk_size * local.price_disk + local.price_ip) * 24 * 30,
    var.cores, var.core_fraction, var.memory, var.disk_type, var.disk_size,
  )
}

output "smtp_user" {
  description = "SMTP login for Postbox: the API key id."
  value       = yandex_iam_service_account_api_key.mailer.id
}

output "smtp_password" {
  description = "SMTP password for Postbox."
  value       = yandex_iam_service_account_api_key.mailer.secret_key
  sensitive   = true
}

output "backup_bucket" {
  description = "Bucket where backup.sh puts the dumps."
  value       = yandex_storage_bucket.backups.bucket
}

output "postbox_api_key_id" {
  description = "Static key id for the Postbox SES-compatible API."
  value       = yandex_iam_service_account_static_access_key.mailer.access_key
}

output "postbox_api_secret" {
  description = "Static key secret for the Postbox SES-compatible API."
  value       = yandex_iam_service_account_static_access_key.mailer.secret_key
  sensitive   = true
}

output "reports_bucket" {
  description = "Bucket where the generated PDFs are stored."
  value       = yandex_storage_bucket.reports.bucket
}

output "reports_access_key" {
  description = "Static key id for the reports bucket (goes to the api container)."
  value       = yandex_iam_service_account_static_access_key.reports.access_key
}

output "reports_secret_key" {
  description = "Static key secret for the reports bucket."
  value       = yandex_iam_service_account_static_access_key.reports.secret_key
  sensitive   = true
}
