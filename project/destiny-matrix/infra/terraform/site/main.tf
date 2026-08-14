data "yandex_dns_zone" "parent" {
  folder_id = var.yc_folder_id
  name      = var.dns_zone_name
}

module "site" {
  source = "../modules/static-site"

  folder_id   = var.yc_folder_id
  domain      = var.domain
  dns_zone_id = data.yandex_dns_zone.parent.id

  # Домен обслуживает node на VM (корень ../server), поэтому CNAME и сертификат бакета выключены:
  # CNAME не сосуществует с A-записью, а сертификат Certificate Manager к nginx не прикрепляется.
  manage_dns         = var.manage_dns
  manage_certificate = var.manage_dns && var.enable_https

  enable_https = var.enable_https
  enable_cdn   = var.enable_cdn

  labels = {
    project = "matritsa"
  }
}

check "cdn_needs_the_domain" {
  assert {
    condition     = !var.enable_cdn || var.manage_dns
    error_message = "enable_cdn забирает себе cname домена: он имеет смысл только при manage_dns = true, иначе CDN и A-запись VM спорят за одно имя."
  }
}
