# infra — инфраструктура и деплой arcana-sense.ru

Сайт отдают **три контейнера на одной машине**: node-сервер Next.js (`web`), FastAPI (`api`) и
Chromium для печати PDF (`browser`); nginx — единая точка входа с TLS. На хосте нет ни node, ни
python. База — файл в томе `api-var`, он переживает пересборку образа. Статику `_next/static`
web-контейнер выкладывает при старте в `/srv/arcana/static`, откуда её отдаёт nginx с диска.
Решение и его причины — `docs/api-contract.md`, раздел «Раскладка деплоя — решено».

**Релиз живёт не здесь, а в `compose/scripts/`:** `release-test.sh` — на тестовый домен,
`release-prod.sh` — на прод. Оба собирают образы, отправляют их в реестр Yandex и на машине
делают только `docker compose pull` и рестарт `arcana.service`. Здесь, в `infra/`, остаётся то,
что живёт вне образов: nginx, машина, приёмка.

**Конфигурация nginx живёт здесь, а не на машине.** Любая правка — таймаут, заголовок, пароль,
фильтр сканеров — сначала в `nginx/`, потом `./deploy-nginx.sh`. Править через ssh нельзя: такие
изменения теряются при пересоздании машины из terraform и не видны в истории.

```
infra/
  deploy-nginx.sh          разложить конфиги nginx: бэкап → nginx -t → reload, при ошибке откат
  nginx/                   источник правды для nginx
    arcana.conf            прод: статика с диска, проксирование, таймаут печати
    arcana-test.conf       тестовый домен: пароль, noindex, открытые вебхук банка и health
    conf.d/                настройки уровня http: сжатие, лимиты, формат лога, карты фильтров
    snippets/              правила отсечения сканеров, подключаются в оба server-блока
  check.sh                 приёмка живого сайта (DNS, TLS, страницы, BFF, кука, ассеты)
  terraform/
    README.md              подробности: раскладка, доставка, стоимость, что проверено
    server/                VM, сеть, IP, A-записи, cloud-init: docker, nginx, служба arcana
    site/                  бакет ассетов (только `_next/static` и картинки) + deploy.sh + check.sh
    modules/static-site/   бакет, публичное чтение, при желании CNAME, сертификат и CDN
```

| корень | state | что трогает |
|---|---|---|
| `server/` | `matritsa/server/terraform.tfstate` | сеть, IP, VM, A-записи `matritsa.` и `api.` |
| `site/` | `matritsa/site/terraform.tfstate` | бакет ассетов, ключ деплоя, (выключено) CDN |

Разные state оставлены намеренно: VM пересоздают часто, бакет — почти никогда, и `destroy`
приложения не может задеть хранилище.

## Путь от нуля до работающего сайта

```bash
tf                                                    # экспортирует TF_VAR_yc_*
source ../terraform/bootstrap/export-backend-env.sh   # ключи к state-бакету
```

**1. Бакет ассетов** (можно пропустить: без него nginx отдаёт `_next/static` с диска)

```bash
cd infra/terraform/site
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply
```

**2. Машина**

```bash
cd ../server
cp terraform.tfvars.example terraform.tfvars     # ssh_public_key = file("~/.ssh/id_ed25519.pub")
terraform init && terraform apply

terraform output cloud_init_log_command           # дождаться `matritsa bootstrap finished`
```

После этого apply уже созданы: docker и docker-compose, nginx на 80, `/srv/arcana/.env` с
адресом сайта и реестром, вход в реестр по IAM-токену из метаданных (`arcana-registry-login`,
пароля на машине нет вовсе) и служба `arcana` — она поднимает `docker compose` из
`/srv/arcana` и ждёт, пока туда приедет `docker-compose.yml` первого релиза.

**3. TLS** — после того как A-записи разошлись (зона делегирована, это минуты):

```bash
terraform output certbot_command                  # один сертификат на matritsa. и api.
```

**4. Первый релиз** — с рабочей машины, не с VM:

```bash
cd ../../compose && scripts/release-prod.sh
```

Скрипт собирает три образа, отправляет их в реестр, приносит на машину `docker-compose.yml`,
дописывает в `.env` тег и перезапускает службу. Сборка идёт **на рабочей машине**: замер на этом
репозитории — 5 862 страницы, пик 628 МБ RSS, 189 с процессорного времени; на 2 vCPU с гарантией
5 % и 2 ГБ памяти это минуты простоя и риск OOM рядом с работающим сайтом.

**5. Приёмка**

```bash
./check.sh                                        # BASE=https://arcana-sense.ru
```

## Релиз

Оба скрипта живут в `compose/scripts/` и начинаются с `assert-release-candidate.sh`: он не даёт
выложить грязное дерево или коммит, для которого нет манифеста единого preflight.

| скрипт | куда | тег образов | чем отличается |
|---|---|---|---|
| `release-test.sh` | `test.arcana-sense.ru` | `test-<sha>` | своя база, тестовый терминал банка, Метрика в сборку не попадает, домен под Basic Auth |
| `release-prod.sh` | `arcana-sense.ru` | `<sha>` | требует `REQUIRE_TEST_EVIDENCE=1`: тот же коммит обязан был пройти на тесте |

Что важно знать про механику:

- **порядок обязателен.** Прод принимает только коммит, для которого в
  `reports/unified/tested-commit.txt` записан тот же sha. Файл пишет `release-test.sh` после
  того, как тестовый домен ответил.
- **откат.** Прошлый тег лежит на машине в `/srv/arcana/.env.previous.tag`: вернуть его в `.env`
  и `sudo systemctl restart arcana`. Образы прошлого релиза чистятся не раньше суток
  (`docker image prune --filter until=24h`), поэтому pull за ними не пойдёт.
- **статика.** Web-контейнер при старте копирует `_next/static` в `/srv/arcana/static`, и nginx
  отдаёт её с диска. Вкладка, открытая до релиза, догрузит свои чанки, пока каталог не
  перезаписан следующим релизом.
- **схема базы.** Отдельного шага миграций нет: контейнер API при старте вызывает
  `Base.metadata.create_all` (`api/app/schema.py`). Значит новая колонка появится сама, а
  переименование или удаление — нет: такие правки надо делать явно, до релиза.
- **диск.** 20 ГБ, каждый релиз добавляет около 2,7 ГБ образов, поэтому чистка в скрипте
  обязательна: без неё машина заполнялась на 100 %.

## Чего инфраструктура не знает

**Дату рождения.** Она не покидает браузер: расчёт для анонимного посетителя идёт в JS, а
серверный `/matrix/calc` нужен только для сохранённых матриц. Ни одна переменная, ни один вывод
и ни один заголовок здесь её не несёт. В логах nginx остаются пути — `/report` и `/matrix/<slug>`
даты не содержат.

**Токен.** Единственный путь браузера к API — BFF внутри node, сессия живёт в httpOnly-куке
`destiny_session`. Прямого пути к FastAPI снаружи нет: `api.` отвечает 301 на сайт, порт 8010
слушает только localhost. `check.sh` проверяет и это: `/api/auth/me` без куки обязан отдать 401,
а имя куки не должно встречаться в HTML.
