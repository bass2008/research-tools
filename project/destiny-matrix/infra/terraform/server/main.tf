locals {
  api_fqdn = "${var.api_subdomain}.${var.site_domain}"
  app_user = "matritsa"
  app_dir  = "/srv/matritsa"
}

data "yandex_compute_image" "boot" {
  family = var.image_family
}

data "yandex_dns_zone" "parent" {
  folder_id = var.yc_folder_id
  name      = var.dns_zone_name
}

resource "yandex_vpc_network" "app" {
  folder_id   = var.yc_folder_id
  name        = "matritsa-net"
  description = "Single network for the matritsa application VM"
}

resource "yandex_vpc_subnet" "app" {
  folder_id      = var.yc_folder_id
  name           = "matritsa-subnet-${var.yc_zone}"
  zone           = var.yc_zone
  network_id     = yandex_vpc_network.app.id
  v4_cidr_blocks = [var.subnet_cidr]
}

resource "yandex_vpc_security_group" "app" {
  folder_id   = var.yc_folder_id
  name        = "matritsa-app"
  description = "Public HTTP/HTTPS and administrative SSH. Node, FastAPI and Postgres stay on localhost."
  network_id  = yandex_vpc_network.app.id

  ingress {
    description    = "SSH, also the deploy channel"
    protocol       = "TCP"
    port           = 22
    v4_cidr_blocks = var.ssh_allowed_cidrs
  }

  ingress {
    description    = "HTTP, also the ACME http-01 challenge"
    protocol       = "TCP"
    port           = 80
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description    = "HTTPS"
    protocol       = "TCP"
    port           = 443
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description    = "Any outbound: apt, NodeSource, pip, Let's Encrypt, payment provider callbacks"
    protocol       = "ANY"
    from_port      = 0
    to_port        = 65535
    v4_cidr_blocks = ["0.0.0.0/0"]
  }
}

# A reserved address costs the same as a dynamic one while it is attached, and it survives
# recreating the VM, so the DNS records and any provider whitelist stay valid.
resource "yandex_vpc_address" "app" {
  folder_id   = var.yc_folder_id
  name        = "matritsa-app"
  description = "Public address of the matritsa application VM"

  external_ipv4_address {
    zone_id = var.yc_zone
  }
}

resource "yandex_compute_instance" "app" {
  folder_id                 = var.yc_folder_id
  name                      = "matritsa-app"
  hostname                  = "matritsa-app"
  zone                      = var.yc_zone
  platform_id               = var.platform_id
  allow_stopping_for_update = true

  resources {
    cores         = var.cores
    core_fraction = var.core_fraction
    memory        = var.memory
  }

  boot_disk {
    initialize_params {
      image_id = data.yandex_compute_image.boot.id
      size     = var.disk_size
      type     = var.disk_type
    }
  }

  network_interface {
    subnet_id          = yandex_vpc_subnet.app.id
    nat                = true
    nat_ip_address     = yandex_vpc_address.app.external_ipv4_address[0].address
    security_group_ids = [yandex_vpc_security_group.app.id]
  }

  metadata = {
    ssh-keys           = "ubuntu:${var.ssh_public_key}"
    serial-port-enable = "1"
    user-data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
      api_fqdn     = local.api_fqdn
      site_fqdn    = var.site_domain
      admin_email  = var.admin_email
      app_user     = local.app_user
      app_dir      = local.app_dir
      web_port     = var.web_port
      api_port     = var.api_port
      node_major   = var.node_major
      swap_size_mb = var.swap_size_mb
      memory_gb    = var.memory
    })
  }
}

# The site itself, not just the API: node on this VM serves every page, so the apex site name is an
# A record here and the bucket CNAME is gone (../site: manage_dns = false).
resource "yandex_dns_recordset" "site" {
  zone_id = data.yandex_dns_zone.parent.id
  name    = "${var.site_domain}."
  type    = "A"
  data    = [yandex_vpc_address.app.external_ipv4_address[0].address]
  ttl     = 300
}

resource "yandex_dns_recordset" "api" {
  zone_id = data.yandex_dns_zone.parent.id
  name    = "${local.api_fqdn}."
  type    = "A"
  data    = [yandex_vpc_address.app.external_ipv4_address[0].address]
  ttl     = 300
}
