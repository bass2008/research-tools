# В отличие от ../site зона создаётся здесь: у .com её ещё нет, а без зоны CNAME домена и
# проверочная запись сертификата некуда лечь. NS домена у регистратора должны смотреть на
# ns1/ns2.yandexcloud.net — значение отдаёт output zone_nameservers.
resource "yandex_dns_zone" "parent" {
  folder_id   = var.yc_folder_id
  name        = var.dns_zone_name
  description = "Authoritative public zone for ${var.domain}"
  zone        = "${var.domain}."
  public      = true
}

module "site" {
  source = "../modules/static-site"

  folder_id   = var.yc_folder_id
  domain      = var.domain
  dns_zone_id = yandex_dns_zone.parent.id

  # Домен обслуживает сам бакет: node на VM держит только .ru, спорить за имя тут некому.
  manage_dns         = true
  manage_certificate = true

  enable_https   = var.enable_https
  enable_cdn     = var.enable_cdn
  max_size_bytes = var.max_size_bytes

  labels = {
    project = "matritsa"
  }
}
