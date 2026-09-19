data "openstack_images_image_v2" "ubuntu" {
  name        = var.image_name
  visibility  = "public"
  most_recent = true
}

resource "openstack_compute_keypair_v2" "bench" {
  name       = "arcana-bench"
  public_key = file(pathexpand(var.ssh_public_key))
}

# Две схемы сети. Публичная подсеть дешевле: сервер получает адрес прямо на порт, роутер не нужен
# (194 ₽/мес). Но квота на публичные подсети у аккаунта нулевая и поднимается только поддержкой —
# `Value not in range: 0 < value < 0`. Пока её нет, работает запасная схема: приватная сеть,
# роутер и плавающий адрес. Переключается одной переменной, когда квоту выдадут.
resource "selectel_vpc_subnet_v2" "public" {
  count         = var.use_public_subnet ? 1 : 0
  project_id    = var.project_id
  region        = var.region
  ip_version    = "ipv4"
  prefix_length = 29
}

resource "openstack_networking_network_v2" "private" {
  count          = var.use_public_subnet ? 0 : 1
  name           = "arcana-bench-net"
  admin_state_up = true
}

resource "openstack_networking_subnet_v2" "private" {
  count           = var.use_public_subnet ? 0 : 1
  name            = "arcana-bench-subnet"
  network_id      = openstack_networking_network_v2.private[0].id
  cidr            = var.subnet_cidr
  dns_nameservers = ["188.93.16.19", "188.93.17.19"]
}

data "openstack_networking_network_v2" "external" {
  external = true
}

resource "openstack_networking_router_v2" "bench" {
  count               = var.use_public_subnet ? 0 : 1
  name                = "arcana-bench-router"
  external_network_id = data.openstack_networking_network_v2.external.id
}

resource "openstack_networking_router_interface_v2" "bench" {
  count     = var.use_public_subnet ? 0 : 1
  router_id = openstack_networking_router_v2.bench[0].id
  subnet_id = openstack_networking_subnet_v2.private[0].id
}

resource "openstack_networking_port_v2" "bench" {
  name       = "arcana-bench-port"
  network_id = var.use_public_subnet ? selectel_vpc_subnet_v2.public[0].network_id : openstack_networking_network_v2.private[0].id

  fixed_ip {
    subnet_id = var.use_public_subnet ? selectel_vpc_subnet_v2.public[0].subnet_id : openstack_networking_subnet_v2.private[0].id
  }
}

resource "openstack_compute_instance_v2" "bench" {
  name              = "arcana-bench"
  flavor_id         = var.flavor_id
  key_pair          = openstack_compute_keypair_v2.bench.name
  availability_zone = var.zone

  # Диск линейки VDS — локальный NVMe, он входит в конфигурацию, отдельный том не нужен. Ради
  # этого диска переезд и затевается: сетевой на проде даёт 15 МБ/с и 224 IOPS.
  image_id = data.openstack_images_image_v2.ubuntu.id

  network {
    port = openstack_networking_port_v2.bench.id
  }

  vendor_options {
    ignore_resize_confirmation = true
  }

  lifecycle {
    ignore_changes = [image_id]
  }
}

resource "openstack_networking_floatingip_v2" "bench" {
  count = var.use_public_subnet ? 0 : 1
  pool  = data.openstack_networking_network_v2.external.name
}

resource "openstack_networking_floatingip_associate_v2" "bench" {
  count       = var.use_public_subnet ? 0 : 1
  floating_ip = openstack_networking_floatingip_v2.bench[0].address
  port_id     = openstack_networking_port_v2.bench.id
}
