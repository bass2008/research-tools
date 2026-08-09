output "registrar_nameservers" {
  description = "Set these NS servers at REG.RU after the first apply."
  value       = ["ns1.yandexcloud.net", "ns2.yandexcloud.net"]
}

output "site_http_url" {
  description = "Direct Object Storage website endpoint available after the first apply."
  value       = "http://${yandex_storage_bucket.site.bucket}.website.yandexcloud.net"
}

output "site_url" {
  description = "Final custom-domain URL."
  value       = var.enable_https ? "https://${var.domain}" : "http://${var.domain}"
}

output "certificate_status_command" {
  description = "Run after delegating NS; enable HTTPS when status becomes ISSUED."
  value       = "yc certificate-manager certificate get --id ${yandex_cm_certificate.site.id}"
}

output "mail_mx" {
  description = "Inbound mail is handled by ImprovMX; aliases are managed in their dashboard."
  value       = yandex_dns_recordset.mail_mx.data
}
