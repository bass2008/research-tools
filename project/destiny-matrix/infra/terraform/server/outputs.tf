output "site_url" {
  description = "Public URL of the site. After certbot this is where node answers through nginx."
  value       = "https://${var.site_domain}"
}

output "api_fqdn" {
  description = "Host that answers 301 to the site. FastAPI itself is not exposed."
  value       = local.api_fqdn
}

output "public_ip" {
  description = "Reserved address of the VM. Survives recreating the instance."
  value       = yandex_vpc_address.app.external_ipv4_address[0].address
}

output "ssh_command" {
  description = "Shell access."
  value       = "ssh ubuntu@${yandex_vpc_address.app.external_ipv4_address[0].address}"
}

output "deploy_command" {
  description = "First release: builds the standalone artifact, ships it, restarts both services."
  value       = "cd infra && ./deploy.sh --host ${yandex_vpc_address.app.external_ipv4_address[0].address}"
}

output "cloud_init_log_command" {
  description = "Run it after the first boot to see whether the bootstrap script finished."
  value       = "ssh ubuntu@${yandex_vpc_address.app.external_ipv4_address[0].address} 'sudo cloud-init status --long && sudo tail -40 /var/log/cloud-init-output.log'"
}

output "certbot_command" {
  description = "One certificate for both names, issued once the A records have propagated."
  value       = "ssh ubuntu@${yandex_vpc_address.app.external_ipv4_address[0].address} 'sudo certbot --nginx -d ${var.site_domain} -d ${local.api_fqdn} -m ${var.admin_email} --agree-tos -n --redirect'"
}

output "services_status_command" {
  description = "Both units at once: FastAPI and the Next.js standalone server."
  value       = "ssh ubuntu@${yandex_vpc_address.app.external_ipv4_address[0].address} 'systemctl status --no-pager matritsa-api matritsa-web'"
}

output "database_url" {
  description = "Connection string used by the API unit. Peer auth over the unix socket, no password."
  value       = "postgresql+psycopg2://${local.app_user}@/${local.app_user}?host=/var/run/postgresql"
}

output "api_internal_url" {
  description = "What the BFF inside node calls. Must match the contract value."
  value       = "http://127.0.0.1:${var.api_port}"
}

output "disk_budget" {
  description = "Where the disk goes: OS, releases of the node artifact, Postgres, logs."
  value = format(
    "%d ГБ диска: ОС ~4 + релизы %d × 1,2 ГБ (жёсткие ссылки на неизменное) + Postgres ~1 + логи ~1 = ~%.1f ГБ занято",
    var.disk_size,
    var.releases_keep,
    4 + 1.2 * var.releases_keep + 2,
  )
}

output "monthly_cost_rub" {
  description = "Street price of this instance shape, VAT included. Sources are in ../README.md §4."
  value = format(
    "%.0f ₽/мес: vCPU %.2f + RAM %.2f + диск %.2f + IP %.2f",
    730 * (var.cores * local.price_vcpu + var.memory * local.price_ram + var.disk_size * local.price_disk + local.price_ip),
    730 * var.cores * local.price_vcpu,
    730 * var.memory * local.price_ram,
    730 * var.disk_size * local.price_disk,
    730 * local.price_ip,
  )
}
