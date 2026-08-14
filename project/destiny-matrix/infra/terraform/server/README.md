# server — VM под FastAPI и Postgres

Самая дешёвая живая машина: `standard-v2`, 2 vCPU с гарантией 5 %, 2 ГБ RAM, 20 ГБ
network-HDD, зарезервированный публичный IP. **1 076 ₽/мес** — раскладка в `../README.md` §2,
таблица цен в `prices.tf`, счёт для текущих переменных: `terraform output monthly_cost_rub`.

Меньше 2 ядер Yandex Cloud не даёт, а гарантия 5 % существует только на `standard-v1` и
`standard-v2`; на `standard-v3` минимум 20 %. Прерываемую VM под базу брать нельзя — её
останавливают минимум раз в сутки.

```bash
tf
source ../../../terraform/bootstrap/export-backend-env.sh
cp terraform.tfvars.example terraform.tfvars     # ssh_public_key = file("~/.ssh/id_ed25519.pub")
terraform init
terraform apply
terraform output cloud_init_log_command
terraform output certbot_command
```

## Что внутри

| ресурс | зачем |
|---|---|
| `yandex_vpc_network` + `yandex_vpc_subnet` | одна сеть, одна подсеть, бесплатно |
| `yandex_vpc_security_group` | внутрь только 22, 80, 443; Postgres не выставлен наружу вообще |
| `yandex_vpc_address` | зарезервированный IP: пока привязан, стоит столько же, сколько динамический, но переживает пересоздание VM вместе с A-записью |
| `yandex_compute_instance` | cloud-init из `cloud-init.yaml.tftpl` |
| `yandex_dns_recordset` | `api.matritsa.webstudiolab.ru` → IP |

`allow_stopping_for_update = true`: смена `core_fraction` или памяти перезапускает машину,
а не пересоздаёт её.

## Что делает cloud-init

Ставит `postgresql`, `nginx`, `certbot`, `python3-venv`. Дальше `bootstrap.sh`:

- системный пользователь `matritsa` с домом `/srv/matritsa`;
- роль и база `matritsa` — вход по unix-сокету через peer, **пароля нет** и хранить его
  негде: ни в метаданных VM, ни в state, ни в unit-файле;
- drop-in для Postgres под 2 ГБ (`shared_buffers = 256MB`, `max_connections = 50`); путь к
  `conf.d` ищется по маске, чтобы мажорная версия не была вбита числом;
- сайт nginx с проксированием на `127.0.0.1:8000`, дефолтный сайт удаляется, `nginx -t`
  перед перезагрузкой.

Приложение он не разворачивает и служб-заглушек не создаёт. Что осталось руками — в
`/srv/matritsa/NEXT-STEPS.md` на самой машине.

```
DATABASE_URL=postgresql+psycopg://matritsa@/matritsa?host=/var/run/postgresql
```

TLS для API выдаёт certbot по http-01 — порт 80 для этого открыт. Команда целиком:
`terraform output certbot_command`. Сертификат Certificate Manager здесь не годится: он
прикрепляется к бакету и CDN, а не к nginx на VM.

## Гигиена

`ssh_allowed_cidrs` по умолчанию `0.0.0.0/0` — после первого входа сузить до своего адреса.
Postgres слушает только localhost, отдельного правила для 5432 нет и быть не должно.
