locals {
  app_dir  = "/srv/arcana"
  zone_dot = "${var.site_domain}."
}

data "yandex_compute_image" "boot" {
  family = var.image_family
}

# Зона создаётся здесь же: отдельного корня под домен больше нет, а без зоны A-записи
# некуда положить. NS домена у регистратора должны смотреть на ns1/ns2.yandexcloud.net.
resource "yandex_dns_zone" "parent" {
  folder_id   = var.yc_folder_id
  name        = var.dns_zone_name
  description = "Authoritative public zone for ${var.site_domain}"
  zone        = local.zone_dot
  public      = true
}

# Реестр образов: сборка идёт на машине разработчика, VM только тянет готовые образы.
resource "yandex_container_registry" "app" {
  folder_id = var.yc_folder_id
  name      = "arcana"
}

# Аккаунт самой VM: ему нужно только читать образы из реестра.
resource "yandex_iam_service_account" "vm" {
  folder_id   = var.yc_folder_id
  name        = "arcana-vm"
  description = "Pulls container images on the application VM"
}

resource "yandex_container_registry_iam_binding" "puller" {
  registry_id = yandex_container_registry.app.id
  role        = "container-registry.images.puller"
  members     = ["serviceAccount:${yandex_iam_service_account.vm.id}"]
}

resource "yandex_vpc_network" "app" {
  folder_id   = var.yc_folder_id
  name        = "arcana-net"
  description = "Single network for the application VM"
}

resource "yandex_vpc_subnet" "app" {
  folder_id      = var.yc_folder_id
  name           = "arcana-subnet-${var.yc_zone}"
  zone           = var.yc_zone
  network_id     = yandex_vpc_network.app.id
  v4_cidr_blocks = [var.subnet_cidr]
}

resource "yandex_vpc_security_group" "app" {
  folder_id   = var.yc_folder_id
  name        = "arcana-app"
  description = "Public HTTP/HTTPS and administrative SSH. Node and FastAPI stay inside docker."
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
    description    = "Any outbound: apt, docker registry, Let's Encrypt, payment provider callbacks"
    protocol       = "ANY"
    from_port      = 0
    to_port        = 65535
    v4_cidr_blocks = ["0.0.0.0/0"]
  }
}

# Зарезервированный адрес стоит столько же, сколько динамический, пока он привязан, и переживает
# пересоздание VM — значит A-записи и белые списки провайдеров остаются валидными.
resource "yandex_vpc_address" "app" {
  folder_id   = var.yc_folder_id
  name        = "arcana-app"
  description = "Public address of the application VM"

  external_ipv4_address {
    zone_id = var.yc_zone
  }
}

resource "yandex_compute_instance" "app" {
  folder_id                 = var.yc_folder_id
  name                      = "arcana-app"
  hostname                  = "arcana-app"
  zone                      = var.yc_zone
  platform_id               = var.platform_id
  allow_stopping_for_update = true
  service_account_id        = yandex_iam_service_account.vm.id

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
      site_fqdn    = var.site_domain
      admin_email  = var.admin_email
      app_dir      = local.app_dir
      registry_id  = yandex_container_registry.app.id
      swap_size_mb = var.swap_size_mb
    })
  }

  depends_on = [yandex_container_registry_iam_binding.puller]
}

# Сайт целиком отдаёт node на этой машине, поэтому apex — A-запись, а не CNAME на бакет.
resource "yandex_dns_recordset" "site" {
  zone_id = yandex_dns_zone.parent.id
  name    = local.zone_dot
  type    = "A"
  data    = [yandex_vpc_address.app.external_ipv4_address[0].address]
  ttl     = 300
}

resource "yandex_dns_recordset" "www" {
  zone_id = yandex_dns_zone.parent.id
  name    = "www.${local.zone_dot}"
  type    = "A"
  data    = [yandex_vpc_address.app.external_ipv4_address[0].address]
  ttl     = 300
}

# ── почта ────────────────────────────────────────────────────────────────────────
# Приём писем на домене — ImprovMX: пересылка на личный ящик, бесплатно и без своего сервера.
# Отправку сайта он не делает (SMTP только на платном тарифе), её берёт Postbox.

resource "yandex_dns_recordset" "mx" {
  zone_id = yandex_dns_zone.parent.id
  name    = local.zone_dot
  type    = "MX"
  data    = ["10 mx1.improvmx.com.", "20 mx2.improvmx.com."]
  ttl     = 300
}

# SPF обязан быть один на домен: две записи считаются ошибкой конфигурации и письма начинают
# попадать в спам. Поэтому здесь сразу оба отправителя — ImprovMX и Postbox.
resource "yandex_dns_recordset" "spf" {
  zone_id = yandex_dns_zone.parent.id
  name    = local.zone_dot
  type    = "TXT"
  data    = ["\"v=spf1 include:spf.improvmx.com include:_spf.yandex.net -all\""]
  ttl     = 300
}

resource "yandex_dns_recordset" "dmarc" {
  zone_id = yandex_dns_zone.parent.id
  name    = "_dmarc.${local.zone_dot}"
  type    = "TXT"
  data    = ["\"v=DMARC1; p=reject\""]
  ttl     = 300
}

# ── отправка писем ───────────────────────────────────────────────────────────────
# Адрес и DKIM-ключи Postbox создаются в консоли: ресурсов postbox в terraform-провайдере нет.
# Всё остальное — здесь: записи DKIM, аккаунт-отправитель, его роль и ключ для SMTP.

resource "yandex_dns_recordset" "dkim" {
  for_each = toset(["1", "2"])

  zone_id = yandex_dns_zone.parent.id
  name    = "${var.postbox_identity}-${each.key}._domainkey.${local.zone_dot}"
  type    = "CNAME"
  data    = ["${var.postbox_identity}-${each.key}.dkim.pstbx.ru"]
  # 600 — как поставил Postbox при создании записей; менять незачем
  ttl = 600
}

resource "yandex_iam_service_account" "mailer" {
  folder_id   = var.yc_folder_id
  name        = "arcana-mailer"
  description = "Sends transactional email through Postbox"
}

resource "yandex_resourcemanager_folder_iam_member" "mailer" {
  folder_id = var.yc_folder_id
  role      = "postbox.sender"
  member    = "serviceAccount:${yandex_iam_service_account.mailer.id}"
}

# API-ключ, а не статический: письма уходят по SMTP, там логин — идентификатор этого ключа.
resource "yandex_iam_service_account_api_key" "mailer" {
  service_account_id = yandex_iam_service_account.mailer.id
  description        = "SMTP credentials for Postbox"
  scopes             = ["yc.postbox.send"]

  # у провайдера рядом со scopes живёт устаревшее scope: без этого план всегда «1 to change»
  lifecycle {
    ignore_changes = [scope]
  }
}

# ── резервные копии базы ─────────────────────────────────────────────────────────
# Бакет создаётся ключами отдельного аккаунта: провайдер настраивает lifecycle и версии
# только по S3-подписи, IAM-токена для этого не хватает.

resource "yandex_iam_service_account" "backup" {
  folder_id   = var.yc_folder_id
  name        = "arcana-backup"
  description = "Owns the database backup bucket"
}

resource "yandex_resourcemanager_folder_iam_member" "backup" {
  folder_id = var.yc_folder_id
  # admin, а не editor: версионирование и правила жизни ставит только администратор бакета
  role   = "storage.admin"
  member = "serviceAccount:${yandex_iam_service_account.backup.id}"
}

resource "yandex_iam_service_account_static_access_key" "backup" {
  service_account_id = yandex_iam_service_account.backup.id
  description        = "S3 credentials for the backup bucket"
}

resource "yandex_storage_bucket" "backups" {
  folder_id  = var.yc_folder_id
  bucket     = var.backup_bucket
  access_key = yandex_iam_service_account_static_access_key.backup.access_key
  secret_key = yandex_iam_service_account_static_access_key.backup.secret_key

  # копии не перезаписывают друг друга по имени, но версии страхуют от случайного delete
  versioning { enabled = true }

  lifecycle_rule {
    id      = "expire-old"
    enabled = true
    expiration { days = 90 }
    noncurrent_version_expiration { days = 30 }
  }

  force_destroy = false

  depends_on = [yandex_resourcemanager_folder_iam_member.backup]
}

# Статус адресов и режим аккаунта Postbox читаются только по S3-подписи (SES-совместимый API),
# поэтому у отправителя есть и статический ключ, и право смотреть настройки.
resource "yandex_resourcemanager_folder_iam_member" "mailer_viewer" {
  folder_id = var.yc_folder_id
  role      = "postbox.auditor"
  member    = "serviceAccount:${yandex_iam_service_account.mailer.id}"
}

resource "yandex_iam_service_account_static_access_key" "mailer" {
  service_account_id = yandex_iam_service_account.mailer.id
  description        = "SES-compatible API access for Postbox diagnostics"
}

# ── готовые PDF ──────────────────────────────────────────────────────────────────
# Отдельный бакет, а не префикс в бэкапах: в отчётах дата рождения, у них свой срок жизни и свой
# ключ доступа, который лежит на машине с api.

resource "yandex_iam_service_account" "reports" {
  folder_id   = var.yc_folder_id
  name        = "arcana-reports"
  description = "Reads and writes the generated report PDFs"
}

resource "yandex_resourcemanager_folder_iam_member" "reports" {
  folder_id = var.yc_folder_id
  role      = "storage.admin"
  member    = "serviceAccount:${yandex_iam_service_account.reports.id}"
}

resource "yandex_iam_service_account_static_access_key" "reports" {
  service_account_id = yandex_iam_service_account.reports.id
  description        = "S3 credentials for the reports bucket"
}

resource "yandex_storage_bucket" "reports" {
  folder_id  = var.yc_folder_id
  bucket     = var.reports_bucket
  access_key = yandex_iam_service_account_static_access_key.reports.access_key
  secret_key = yandex_iam_service_account_static_access_key.reports.secret_key

  # ссылка выдаётся с подписью на час, публичного доступа нет
  anonymous_access_flags {
    read        = false
    list        = false
    config_read = false
  }

  lifecycle_rule {
    id      = "expire-old"
    enabled = true
    # отчёт печатается заново по кнопке, поэтому годами хранить его незачем
    expiration { days = 180 }
  }

  force_destroy = false

  depends_on = [yandex_resourcemanager_folder_iam_member.reports]
}
