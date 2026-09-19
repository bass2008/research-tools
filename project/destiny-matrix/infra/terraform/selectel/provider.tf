# Проект и сервисный пользователь заведены в панели: провайдер selectel здесь не нужен,
# всё создаётся через OpenStack API.
provider "openstack" {
  auth_url    = var.auth_url
  domain_name = var.account
  tenant_id   = var.project_id
  user_name   = var.username
  password    = var.password
  region      = var.region
}

# Публичная подсеть заказывается через собственный API Selectel, в OpenStack такого ресурса нет.
provider "selectel" {
  domain_name = var.account
  username    = var.username
  password    = var.password
  auth_region = var.region
  auth_url    = "${var.auth_url}/"
}
