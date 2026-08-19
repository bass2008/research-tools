# modules/static-site

Бакет Object Storage с публичным чтением под ассеты сайта, при желании — CNAME на домен,
управляемый сертификат и CDN. Содержимое модуль не заливает: это делает
`../../site/deploy.sh`, причины в `../../README.md` §2.

Зону модуль только читает: `dns_zone_id` приходит снаружи. Свою зону он не создаёт и не меняет
никогда — она принадлежит корню `terraform/arcana-sense.ru`.

**В текущей раскладке сайт отдаёт node на VM, а не бакет** (`../../README.md` §1), поэтому домен
модулю не принадлежит: `manage_dns = false`, `manage_certificate = false`. Бакет остаётся
хранилищем ассетов, доступным по path-style адресу
`https://storage.yandexcloud.net/<bucket>/…` — под общим сертификатом Object Storage, без
своего домена и без своего сертификата.

```hcl
module "site" {
  source = "../modules/static-site"

  folder_id   = var.yc_folder_id
  domain      = "arcana-sense.ru"
  dns_zone_id = data.yandex_dns_zone.parent.id

  manage_dns         = false # домен держит A-запись на VM
  manage_certificate = false # TLS выдаёт certbot на nginx
  enable_cdn         = false
}
```

## Что создаёт

| ресурс | условие | зачем |
|---|---|---|
| `yandex_iam_service_account` + `storage.admin` + статический ключ | всегда | ключ для заливки; `storage.admin`, потому что создание бакета доступно только ему |
| `yandex_storage_bucket` | всегда | `anonymous_access_flags.read = true`, листинг закрыт, `max_size` как предохранитель от неограниченного счёта |
| `yandex_cm_certificate` + запись валидации | `manage_certificate` | DNS-CNAME challenge; нужен только когда TLS для домена терминирует бакет или CDN |
| `yandex_dns_recordset` (CNAME) | `manage_dns` | CNAME домена на website-endpoint бакета или на CDN |
| `yandex_cdn_origin_group` + `yandex_cdn_resource` | `enable_cdn` | edge-кэш перед бакетом |

## Почему CNAME выключается, а не остаётся «на всякий случай»

CNAME и A-запись на одном имени не сосуществуют: RFC запрещает, Cloud DNS отказывает, и apply
падает конфликтом записей. Домен теперь у VM (`../server`), значит модуль обязан выпустить его
из-под управления. Сертификат Certificate Manager к nginx прикрепить нельзя (он живёт только на
бакете, CDN и балансировщике), поэтому вместе с CNAME отключается и он.

## Две фазы (только при `manage_certificate = true`)

`enable_https = false` на первом apply: сертификат создаётся вместе с записью валидации, но к
бакету ещё не прикрепляется — прикрепить не выпущенный нельзя. После `ISSUED` — apply с
`enable_https = true`.

## Имя бакета

По умолчанию равно домену. Из-за точек в имени работать с бакетом можно только в path-style
адресации (`use_path_style`, `--s3-force-path-style`) — иначе не сходится wildcard-сертификат
Object Storage. Совпадение имени с доменом обязательно только для HTTPS на website-endpoint,
то есть для варианта, где сайт отдаёт бакет.

## `enable_cdn` подразумевает `manage_dns`

CDN-ресурс забирает себе `cname = var.domain`, поэтому включать его имеет смысл только когда
домен принадлежит бакету. CDN перед node-сервером — это другой ресурс с origin-группой на IP
машины; здесь его нет. Корень `../../site` проверяет это `check`-блоком.
