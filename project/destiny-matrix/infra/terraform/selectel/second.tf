# Вторая машина — только на время замера: сравнить 1 ядро против 2 при живом сайте и понять,
# стоят ли 150 ₽ разницы второго ядра. Включается переменной, после отчёта выключается и
# ресурсы уходят.
resource "openstack_networking_port_v2" "second" {
  count      = var.second_machine ? 1 : 0
  name       = "arcana-bench2-port"
  network_id = openstack_networking_network_v2.private[0].id

  fixed_ip {
    subnet_id = openstack_networking_subnet_v2.private[0].id
  }
}

resource "openstack_compute_instance_v2" "second" {
  count             = var.second_machine ? 1 : 0
  name              = "arcana-bench2"
  flavor_id         = var.second_flavor_id
  key_pair          = openstack_compute_keypair_v2.bench.name
  availability_zone = var.zone
  image_id          = data.openstack_images_image_v2.ubuntu.id

  network {
    port = openstack_networking_port_v2.second[0].id
  }

  vendor_options {
    ignore_resize_confirmation = true
  }

  lifecycle {
    ignore_changes = [image_id]
  }
}

resource "openstack_networking_floatingip_v2" "second" {
  count = var.second_machine ? 1 : 0
  pool  = data.openstack_networking_network_v2.external.name
}

resource "openstack_networking_floatingip_associate_v2" "second" {
  count       = var.second_machine ? 1 : 0
  floating_ip = openstack_networking_floatingip_v2.second[0].address
  port_id     = openstack_networking_port_v2.second[0].id
}

output "second_ip" {
  value = var.second_machine ? openstack_networking_floatingip_v2.second[0].address : "—"
}
