resource "yandex_dns_zone" "domain" {
  folder_id   = var.yc_folder_id
  name        = "webstudiolab-ru"
  description = "Authoritative public zone for ${var.domain}"
  zone        = "${var.domain}."
  public      = true
}

resource "yandex_cm_certificate" "site" {
  folder_id   = var.yc_folder_id
  name        = "webstudiolab-site"
  description = "Managed TLS certificate for ${var.domain}"
  domains     = [var.domain]

  managed {
    challenge_type = "DNS_CNAME"
  }
}

resource "yandex_dns_recordset" "certificate_validation" {
  zone_id = yandex_dns_zone.domain.id
  name    = yandex_cm_certificate.site.challenges[0].dns_name
  type    = yandex_cm_certificate.site.challenges[0].dns_type
  data    = [yandex_cm_certificate.site.challenges[0].dns_value]
  ttl     = 300
}

resource "yandex_dns_recordset" "site" {
  zone_id = yandex_dns_zone.domain.id
  name    = "${var.domain}."
  type    = "ANAME"
  data    = ["${yandex_storage_bucket.site.bucket}.website.yandexcloud.net."]
  ttl     = 300
}

resource "yandex_dns_recordset" "mail_mx" {
  zone_id = yandex_dns_zone.domain.id
  name    = "${var.domain}."
  type    = "MX"
  data    = ["10 mx1.improvmx.com.", "20 mx2.improvmx.com."]
  ttl     = 300
}

resource "yandex_dns_recordset" "spf" {
  zone_id = yandex_dns_zone.domain.id
  name    = "${var.domain}."
  type    = "TXT"
  # Without inner quotes Yandex DNS splits an unquoted value on spaces into separate
  # character-strings, and SPF concatenates them without a separator.
  # Nothing sends as this domain, so ImprovMX is the only authorized source and the rest is -all.
  data = ["\"v=spf1 include:spf.improvmx.com -all\""]
  ttl  = 300
}

resource "yandex_dns_recordset" "dmarc" {
  zone_id = yandex_dns_zone.domain.id
  name    = "_dmarc.${var.domain}."
  type    = "TXT"
  data    = ["\"v=DMARC1; p=reject\""]
  ttl     = 300
}
