# Реестр образов. У Cloudflare своего нет, а Yandex Container Registry уезжает вместе с облаком:
# при переключении .env токен к нему протух, и compose не смог стянуть образ — релиз бы встал.
resource "selectel_craas_registry_v1" "arcana" {
  name       = "arcana"
  project_id = var.project_id
}

resource "selectel_craas_token_v1" "deploy" {
  project_id = var.project_id
  token_ttl  = "1y"
}
