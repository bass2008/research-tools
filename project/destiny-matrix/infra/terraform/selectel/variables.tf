variable "account" {
  type        = string
  description = "Номер аккаунта Selectel, он же domain_name в OpenStack."
}

variable "username" {
  type        = string
  description = "Имя сервисного пользователя."
}

variable "password" {
  type        = string
  description = "Пароль сервисного пользователя."
  sensitive   = true
}

variable "project_id" {
  type        = string
  description = "ID проекта Selectel."
}

variable "region" {
  type        = string
  description = "Пул Selectel."
  default     = "ru-7"
}

variable "zone" {
  type        = string
  description = "Сегмент пула. Диск у линейки VDS локальный, поэтому сервер живёт целиком в одном сегменте."
  default     = "ru-7a"
}

variable "auth_url" {
  type    = string
  default = "https://cloud.api.selcloud.ru/identity/v3"
}

variable "flavor_id" {
  type        = string
  description = <<-TEXT
    VDS1.1-2048-25: 1 vCPU, 2 ГБ, 25 ГБ локального диска. Диск в линейке VDS фиксирован, отдельным
    томом локальный NVMe не подключить, поэтому меньший диск достаётся только вместе с меньшим
    числом ядер. На проде ядра всё равно нарезаны по 5 %, то есть обещано 0,1 ядра суммарно.
    Прежний кандидат — 12202 (VDS1.2-2048-40, 2 vCPU, 40 ГБ).
  TEXT
  default     = "12201"
}

variable "image_name" {
  type        = string
  description = "Тот же выпуск, что на проде, иначе замер сравнивает не машины, а дистрибутивы."
  default     = "Ubuntu 24.04 LTS 64-bit"
}

variable "ssh_public_key" {
  type        = string
  description = "Ключ, которым ходим на прод."
  default     = "~/.ssh/id_rsa.pub"
}

variable "subnet_cidr" {
  type    = string
  default = "192.168.77.0/24"
}

variable "use_public_subnet" {
  type        = bool
  description = <<-TEXT
    Схема сети. true — сервер в публичной подсети: адрес приходит прямо на порт, роутер не нужен
    и из счёта уходят 194 ₽/мес. Требует квоты `network_subnets_29`, которой у аккаунта нет:
    quota-manager отвечает «Value not in range: 0 < value < 0», поднимает только поддержка.
    false — приватная сеть, роутер и плавающий адрес; работает всегда.
  TEXT
  default     = false
}

variable "second_machine" {
  type        = bool
  description = "Поднять вторую машину на время замера. После отчёта выключить: она платная."
  default     = false
}

variable "second_flavor_id" {
  type        = string
  description = "VDS1.2-2048-40: 2 vCPU, 2 ГБ, 40 ГБ — против чего сравниваем одно ядро."
  default     = "12202"
}
