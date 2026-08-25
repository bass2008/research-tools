# infra — инфраструктура и деплой arcana-sense.ru

Сайт отдаёт **node-сервер Next.js (standalone) на той же машине, что FastAPI**, nginx — единая
точка входа с TLS. Статического экспорта в бакет больше нет: решение и его причины —
`docs/api-contract.md`, раздел «Раскладка деплоя — решено».

**Конфигурация nginx живёт здесь, а не на машине.** Любая правка — таймаут, заголовок, пароль,
фильтр сканеров — сначала в `nginx/`, потом `./deploy-nginx.sh`. Править через ssh нельзя: такие
изменения теряются при пересоздании машины из terraform и не видны в истории.

```
infra/
  deploy.sh                релиз: сборка артефакта → доставка на машину → рестарт служб
  deploy-nginx.sh          разложить конфиги nginx: бэкап → nginx -t → reload, при ошибке откат
  nginx/                   источник правды для nginx
    arcana.conf            прод: статика с диска, проксирование, таймаут печати
    arcana-test.conf       тестовый домен: пароль, noindex, открытые вебхук банка и health
    conf.d/                настройки уровня http: сжатие, лимиты, формат лога, карты фильтров
    snippets/              правила отсечения сканеров, подключаются в оба server-блока
  check.sh                 приёмка живого сайта (DNS, TLS, страницы, BFF, кука, ассеты)
  terraform/
    README.md              подробности: раскладка, доставка, стоимость, что проверено
    server/                VM, сеть, IP, A-записи, cloud-init: node + FastAPI + Postgres + nginx
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

После этого apply уже созданы: пользователь `matritsa`, база `matritsa`, `JWT_SECRET` в
`/srv/matritsa/api.env`, node из NodeSource, swap, nginx на 80, **обе службы включены** и ждут
код (`ConditionPathExists` на каталог релиза держит их в `inactive`, а не в падении).

**3. TLS** — после того как A-записи разошлись (зона делегирована, это минуты):

```bash
terraform output certbot_command                  # один сертификат на matritsa. и api.
```

**4. Первый релиз** — с рабочей машины, не с VM:

```bash
cd ../../ && ./deploy.sh
```

`deploy.sh` собирает фронт, проверяет, что артефакт standalone на месте, доставляет его и код
API, ставит venv, переключает симлинки `current` и перезапускает обе службы. Сборка идёт
**на рабочей машине**: замер на этом репозитории — 5 862 страницы, пик 628 МБ RSS, 189 с
процессорного времени; на 2 vCPU с гарантией 5 % это минуты простоя и риск OOM рядом с Postgres.

**5. Приёмка**

```bash
./check.sh                                        # BASE=https://arcana-sense.ru
```

## deploy.sh

| флаг | что делает |
|---|---|
| — | сборка → фронт → API → ассеты в бакет → проверка |
| `--skip-build` | доставить уже собранное |
| `--web-only` / `--api-only` | только одна половина |
| `--no-assets` | не трогать бакет |
| `--host 1.2.3.4` | адрес вручную, без `terraform output` |
| `--keep N` | сколько релизов оставить на машине (по умолчанию 3, минимум 2) |
| `--dry-run` | показать, что уехало бы; ничего не менять |

Что важно знать про механику:

- **релизы и откат.** Артефакт лежит в `/srv/matritsa/web/releases/<UTC-таймстемп>`, служба
  смотрит в симлинк `current`, переключение — одним `mv -T`. Откат — это `ln -sfn` на прошлый
  каталог и `systemctl restart matritsa-web`.
- **жёсткие ссылки.** `rsync --link-dest` на предыдущий релиз: между сборками меняются единицы
  страниц из 5 856, остальное не занимает диск повторно и не едет по сети.
- **пул чанков.** `_next/static` копится в `/srv/matritsa/web/static` без удаления и отдаётся
  nginx-ом: вкладка, открытая до релиза, догружает свои старые чанки, а не ловит ошибку.
- **миграции.** `alembic upgrade head` живёт в `ExecStartPre` службы API, а не в скрипте: схема
  догоняется до кода при каждом старте, включая старт после перезагрузки машины.

## Чего инфраструктура не знает

**Дату рождения.** Она не покидает браузер: расчёт для анонимного посетителя идёт в JS, а
серверный `/matrix/calc` нужен только для сохранённых матриц. Ни одна переменная, ни один вывод
и ни один заголовок здесь её не несёт. В логах nginx остаются пути — `/report` и `/matrix/<slug>`
даты не содержат.

**Токен.** Единственный путь браузера к API — BFF внутри node, сессия живёт в httpOnly-куке
`destiny_session`. Прямого пути к FastAPI снаружи нет: `api.` отвечает 301 на сайт, порт 8010
слушает только localhost. `check.sh` проверяет и это: `/api/auth/me` без куки обязан отдать 401,
а имя куки не должно встречаться в HTML.
