# site — статика matritsa.webstudiolab.ru

Корень для бакета, сертификата, CNAME и (опционально) CDN. Один вызов
`../modules/static-site` плюс два скрипта. Полная картина, цены и обоснование выбора —
`../README.md`.

```bash
tf
source ../../../terraform/bootstrap/export-backend-env.sh
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply                       # enable_https = false
terraform output certificate_status_command
terraform apply -var enable_https=true
./deploy.sh
./check.sh
```

## deploy.sh

Сборка → синхронизация каталога → сброс кэша CDN → проверка curl-ом.

| флаг | что делает |
|---|---|
| `--skip-build` | не вызывать `npm run build` |
| `--dry-run` | показать разницу, ничего не менять (заодно выключает purge) |
| `--no-purge` | не сбрасывать кэш CDN |
| `--no-check` | не проверять сайт после заливки |

Переменная `S3_ENDPOINT` подменяет адрес Object Storage — нужна только для прогона против
локального S3-сервера.

Скрипт берёт имя бакета и ключи из `terraform output`, поэтому перед первым деплоем корень
должен быть применён. Пустой вывод — это ошибка, а не «зальём в корень бакета»: проверяется
явно.

## check.sh

Приёмка опубликованного сайта: CNAME, код ответа на `/`, субъект сертификата,
`Cache-Control: no-cache` на HTML, 404 на отсутствующий объект, запрет анонимного листинга.
Возвращает 1 при любом нарушении.

```bash
DOMAIN=matritsa.webstudiolab.ru ./check.sh
```

## objects.tf

Выключенный по умолчанию вариант «каждый файл — ресурс Terraform» (`manage_objects = true`).
Живёт здесь, а не в модуле, потому что провайдер `aws` конфигурируется ключами, которые модуль
возвращает. Когда его стоит включать и когда нет — `../README.md` §1.

Включать только после первого apply: до него ключей ещё нет, а провайдер `aws` настраивается
из вывода модуля.

## Если первый apply упал на AccessDenied

Роль `storage.admin` выдаётся сервисному аккаунту в том же apply, которым создаётся бакет, а
права в IAM расходятся не мгновенно. `depends_on` на `yandex_resourcemanager_folder_iam_member`
стоит, но от задержки распространения он не спасает. Лечится повторным apply — состояние уже
согласовано, изменится только то, что не успело.
