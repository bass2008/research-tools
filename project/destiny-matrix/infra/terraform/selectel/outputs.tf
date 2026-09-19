output "public_ip" {
  value = var.use_public_subnet ? openstack_compute_instance_v2.bench.access_ip_v4 : openstack_networking_floatingip_v2.bench[0].address
}

output "ssh" {
  value = "ssh root@${var.use_public_subnet ? openstack_compute_instance_v2.bench.access_ip_v4 : openstack_networking_floatingip_v2.bench[0].address}"
}

output "scheme" {
  value = var.use_public_subnet ? "публичная подсеть, без роутера" : "приватная сеть + роутер (194 ₽/мес), пока нет квоты на публичную подсеть"
}

output "registry" {
  value = try(selectel_craas_registry_v1.arcana.endpoint, "—")
}

output "registry_user" {
  value     = try(selectel_craas_token_v1.deploy.username, "—")
  sensitive = true
}
