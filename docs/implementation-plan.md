# Implementation: конвейер `drill` (как строим)

Статус: имплементейшн-спека (v1). Пара к `design-drill.md`: **design = ЧТО** (поведение, FSM,
принципы), **этот док = КАК** (процессы, зависимости, контракты Redis/WS, механика хендовера,
сигнатуры функций, порядок PR-ов). Где расходятся — прав `design-drill.md`; сюда переносим
только конкретику реализации.

Все инфраструктурные решения, которые можно отменить, собраны в **§11**. Термины кода — на
английском.

---

## 0. Топология процессов

Пять процессов на одной машине (localhost):

```
┌─────────────┐   POST /api/node/*        ┌──────────────────────┐
│  React SPA  │ ────────────────────────► │  FastAPI (server.py) │
│ (frontend)  │ ◄──── WS /ws (read) ────  │  uvicorn :8000       │
└─────────────┘                           └──────────┬───────────┘
                                        enqueue Celery│  ▲ SUBSCRIBE "events"
                                                      ▼  │ (fan-out в WS)
                                              ┌───────────────────┐
                                              │      Redis        │  broker + backend +
                                              │   :6379           │  очередь задач + pub/sub
                                              └───────┬───────────┘
                          LPUSH taskq / BRPOP result: │ ▲ PUBLISH "events"
                                                      ▼ │
        ┌──────────────────────┐  BRPOP taskq   ┌──────┴────────────┐
        │  Celery worker(s)    │◄──────────────►│  task-worker-mcp  │  (stdio MCP,
        │  tasks.py (-P threads)│  LPUSH result: │  watch/submit     │   спавнит Claude Code)
        │  full_load/search    │                └──────┬────────────┘
        │  сам; LLM → в taskq  │                       │ tools
        └──────────────────────┘                ┌──────▼────────────┐
                                                 │   Claude Code     │  workflow:
                                                 │  (workflow)       │  watch→агенты→submit
                                                 └───────────────────┘
```

- **Redis** — единственная новая инфра. Одновременно: (a) брокер Celery, (b) result-backend
  Celery, (c) транспорт LLM-задач `Celery ↔ task-worker-mcp`, (d) шина событий `workers → WS`.
- **FastAPI** — пишущие эндпоинты (кладут задачу в Celery) + read-канал `/ws`; подписан на
  Redis-канал `events` и веерит апдейты в подключённые сокеты. Отдаёт React-dist и статику `reports/` (готовые HTML-отчёты Opus).
- **Celery worker** — `full_load`/`search` выполняет сам (HTTP к XMLRiver). LLM-задачи
  (`classify`/`score`/`analyze`) кладёт в Redis-очередь и **блокирующе ждёт** результат.
- **task-worker-mcp** — stdio-MCP, который спавнит Claude Code. Мост Redis↔Claude: `watch`
  (забрать задачи) и `submit_result` (вернуть результат).
- **Claude Code (workflow)** — подключён к task-worker-mcp; крутит `watch` → оркестрирует
  агентов по моделям (Sonnet/Haiku/Opus) → шлёт `submit_result`.

---

## 1. Зависимости и окружение

Ставим в `research3.12`:
```bash
conda install -n research3.12 -c conda-forge redis-server celery redis-py
conda run -n research3.12 pip install "uvicorn[standard]"   # тянет websockets для FastAPI WS
```
- `redis-server` — бинарь брокера (systemd-юнит не нужен; гоняем `redis-server --port 6379`
  или через conda). `redis-py` — клиент. `celery` — очередь. `uvicorn[standard]` даёт WS.
- `task-worker-mcp` — отдельный пакет: `mcp>=1.2.0` + `redis>=5`. **Без `anthropic`, без аудио.**

`.env` (дополнить существующий `XMLRIVER_USER/KEY`):
```
REDIS_URL=redis://127.0.0.1:6379
XMLRIVER_YANDEX_URL=http://xmlriver.com/search_yandex/xml
XMLRIVER_GOOGLE_URL=http://xmlriver.com/search/xml
```
Модели агентов (classify=Sonnet, score=Haiku, analyze=Opus 1M xhigh) задаёт workflow Claude
Code, не конфиг сервера.

---

## 2. Карта Redis (транспортный контракт)

Одна инстанция, БД по назначению:
| Что | Ключ/канал | Кто пишет | Кто читает |
|---|---|---|---|
| Celery broker | БД `0` (управляет Celery) | Celery | Celery |
| Celery result-backend | БД `1` (управляет Celery) | Celery | Celery |
| Очередь LLM-задач | list `taskq` | Celery LLM-таск (`LPUSH`) | mcp `watch` (`BRPOP`) |
| Результат задачи | list `result:{task_id}` | mcp `submit_result` (`LPUSH`) | Celery LLM-таск (`BRPOP` c таймаутом) |
| Шина событий | pub/sub канал `events` | workers + эндпоинты (`PUBLISH`) | WS-сервер (`SUBSCRIBE`) |

Payload `taskq`: `{"task_id","type","params","prompt"}` (сервер инлайнит текст `prompts/{type}.md`
в `prompt`, чтобы Claude не лез в репозиторий). Payload `result:{task_id}`: `{"ok":bool,"result":{…},"error":str|null}`.
Событие `events`: конверт из §6.

`task`-таблица (SQLite, `design §3`) — **источник истины и аудит** для вкладки Task; Redis-списки
— только транспорт «здесь и сейчас».

---

## 3. Хендовер `Celery ↔ task-worker-mcp ↔ Claude` (детально)

Закрывает отложенный пункт «механика возврата результата LLM-задачи».

Последовательность (на примере `classify`):
1. Эндпоинт/оркестратор ставит Celery-таск `classify_task`.
2. Воркер (тред): пишет `task`-строку `QUEUED→RUNNING` + `PUBLISH events {task}`; формирует
   `params`; `LPUSH taskq {task_id,type:"classify",params,prompt}`; затем
   `BRPOP result:{task_id}` с таймаутом `T` (напр. 600 c для classify/score, 1800 c для analyze).
3. `watch` (MCP): `BRPOP taskq` и **дренит все готовые** (до `max_tasks`) — отдаёт Claude пачку,
   чтобы workflow фанил агентов параллельно (это и есть «не одно-задачный» из design §5).
4. Workflow Claude: по `type` берёт модель (classify→Sonnet, score→Haiku, analyze→Opus 1M xhigh),
   гоняет агента с `prompt`+`params`, получает валидный JSON (schema из промпта); вызывает
   `submit_result(task_id, result)`.
5. `submit_result` (MCP): `LPUSH result:{task_id} {ok,result}`.
6. Воркер разблокируется на `BRPOP`, пишет результат в `node`/`serp`, `task→DONE`,
   `PUBLISH events {node…}` + `{task}`, возвращает значение таска.

**Отказы (без ретрая, без частичных):** `BRPOP` таймаут ИЛИ `ok=false` → `task→FAILED`,
`PUBLISH events {log:error}`, узел **остаётся как был** (design §0/§2). Оркестратор `drill`
ловит исключение шага, логирует и продолжает остальное поддерево.

**Почему блокирующий воркер ок:** LLM-таск ждёт I/O (Redis/сеть), не CPU → пул **`-P threads`**,
`-c` подобрать под число одновременных `analyze` (напр. 12). Блокировка треда дешёвая.
Альтернатива fire-and-forget сломала бы последовательность `search→score→analyze` — отвергнута (§11).

---

## 4. Celery-приложение и задачи

`celery_app.py`:
```python
app = Celery("drill", broker=f"{REDIS_URL}/0", backend=f"{REDIS_URL}/1")
app.conf.update(task_track_started=True, worker_prefetch_multiplier=1,
                task_acks_late=True, result_expires=3600)
# запуск: celery -A celery_app worker -P threads -c 12 --loglevel=info
```

`tasks.py` — сигнатуры (каждая: обновляет `task`-строку, публикует события, пишет в модель):
| Таск | Класс | Делает |
|---|---|---|
| `full_load(phrase)` | не-LLM | краул поддерева (§5), прогресс в `events`; `→FULLY_LOADED` |
| `search(phrase)` | не-LLM | XMLRiver yandex+google топ-10 → `serp`; `TRANSACTIONAL→SEARCHED` |
| `classify(root)` | LLM | собрать поддерево (чанки, §5), хендовер; пишет `kind`+`FULLY_LOADED→TRANSACTIONAL\|CATEGORY\|INFORMATIONAL\|NAVIGATIONAL` |
| `score(phrases)` | LLM (батч) | хендовер; пишет `score` (итог) + `competition_yandex/google` (сырые) + `score_weights`; `SEARCHED→SCORED\|LOW_SCORED` (порог 60); логирует сырые+итог |
| `analyze(phrase)` | LLM | хендовер (Opus); пишет `verdict`+`verdict_score`, сохраняет HTML → `reports/{id}.html` + строка `report(id,node,link)`; `SCORED→ANALYZED` |
| `drill(phrase, analyze_min_score=60)` | оркестратор | см. ниже |

`score` дополнительно **логирует** по каждой фразе сырые входы и итог, напр.:
`score "убрать фон с видео": y=80 g=65 w=0.6/0.4 → score=25`. Сырые `competition_yandex/google`
+ `score_weights` лежат и в `node` — этого достаточно для перекалибровки весов/гейтов позже без
повторного прогона LLM.

**`drill`** — не Celery-canvas, а обычный таск-оркестратор (проще для ветвистого дерева):
последовательно вызывает `full_load(root)`, `classify(root)`, затем по каждому `TRANSACTIONAL`
в поддереве `search`→`score`, и для `score>min` — `analyze`. `search`/`score` кандидатов гоним
пачками (score батчами 8–15). Каждый шаг обёрнут `try/except`: падение → лог, продолжаем.
Идемпотентность: пропускаем узлы, уже находящиеся в целевом статусе (резюм повторного `drill`).

---

## 5. Изменения в `wscore.py`

- **`migrate(con)`** — идемпотентно добавляет колонки `node` (design §3) через
  `PRAGMA table_info` + `ALTER TABLE ADD COLUMN`; `CREATE TABLE IF NOT EXISTS serp/task/report`.
  Вызывается из `connect()` до `_maybe_backfill`.
- **`freq_band(freq)`** → `'LOW'|'EVAL'|'HEAD'` (границы 50 / 30000). Бэкфилл проставляет
  `freq_band` и `status='NEW'` дефолтом всем узлам.
- **`full_load(con, root, floor=50, workers=6, on_progress=None)`** — best-first краул:
  фронтир = загруженные, но не `queried` узлы поддерева с `freq≥floor`; `ThreadPoolExecutor(workers)`
  параллелит `load_phrase`; DAG-дедуп (каждая фраза фетчится один раз — `queried` флаг);
  ниже `floor` вглубь не идём (узел+ребро всё равно пишем); `on_progress(done,total,phrase)`
  дёргает публикацию в `events`. Крутит, пока фронтир не пуст.
- **`subtree_nodes(con, root, floor=50)`** — обход поддерева → `[{phrase,freq,children:[phrase…]}]`
  (дети `<floor` отфильтрованы) для `classify`; чанкует по ≤~120 узлов (каждый узел
  самодостаточен — несёт своих детей, межчанковых зависимостей нет).
- **`set_status(con, phrase, status, **cols)`** — единая запись статуса+полей + возврат
  дельты узла для события.

---

## 6. Контракт WebSocket `/ws`

Закрывает отложенный пункт «контракты WS-сообщений».

**Клиент → сервер:**
```
{"action":"subscribe"}                 -> сервер шлёт snapshot корней
{"action":"expand","phrase":"…"}       -> сервер шлёт node-дельты детей фразы (ЧИСТОЕ чтение)
```
`expand` — **только проекция уже загруженного** (`wscore.project`); данные НЕ тянет. Если фраза
не загружена → отдаём её текущих детей (возможно пусто); подгрузка — явный write (`POST
/api/node/load`). Это осознанное CQRS-изменение против нынешнего авто-фетча в `/api/expand`.

**Сервер → клиент** (конверт `{"type":…,"data":…}`):
| `type` | `data` |
|---|---|
| `snapshot` | `{root, children:[<node>…]}` — начальное дерево/поддерево |
| `node` | `<node>` — дельта одного узла: `{phrase,freq,status,kind,score,verdict,verdict_score,report_link?,task_id,error,cached,childCount,children?}` |
| `log` | `{ts,level,stage,node,msg}` |
| `task` | `{id,type,node,status,created_at,started_at,finished_at,error}` |
| `log_cleared` | `{}` — лог очищен (кнопка «Удалить всё»); клиент чистит вкладку Лог |
| `report` | `{id, node, title, verdict, verdict_score, link, created_at}` — новый отчёт (вкладка «Отчёты») |

Реализация: события в Redis-канал `events` пишут воркеры/эндпоинты; **фоновая корутина на
старте FastAPI** (lifespan, работает независимо от клиентов) делает `SUBSCRIBE events` и на
каждое событие (а) фанит его всем WS-клиентам, (б) для `log`-события дописывает строку в
лог-файл (§6.1). На `connect` шлём snapshot + backlog (хвост лог-файла). `expand` — синхронная
read-only проекция.

### 6.1 Логи в файл (само-диагностика LLM)

- Файл **`logs/drill.log`** (под корнем `research/`), создаётся на старте сервера.
- **Единственный писатель** — events-подписчик FastAPI (§6): одна строка на `log`-событие,
  формат `ISO-ts · LEVEL · stage · "node" · msg` (тот же, что в UI). Пишется всегда, даже без
  открытого браузера — чтобы LLM читал файл сам, не прося пользователя скинуть логи.
- Ротацию не делаем (append достаточно). Хвост (последние N строк) отдаём новому WS-клиенту
  как backlog при `connect`.
- **`POST /api/logs/clear`** — `truncate` файла + `PUBLISH events {type:"log_cleared"}`;
  клиенты чистят вкладку Лог. Единственная операция, стирающая лог.

---

## 7. HTTP-эндпоинты (FastAPI)

Все write-команды: pydantic-body с `phrase`, кладут Celery-таск, ставят `node.task_id`,
блокируют кнопки, сразу возвращают `{"task_id":…}` (ack). Прогресс/результат — по `/ws`.
```
POST /api/node/load       {phrase}                     -> load 1 уровень (Celery)
POST /api/node/full-load  {phrase}                     -> full_load
POST /api/node/op         {phrase, op}                 -> один шаг classify|search|score|analyze
POST /api/node/drill      {phrase, analyze_min_score?} -> оркестратор
POST /api/node/kind       {phrase, kind}               -> ручной Fix kind (без Celery, сразу пишет)
GET  /api/estimate?phrase=…   -> {nodes, requests} — нижняя оценка объёма для диалога (§8)
GET  /reports/{id}.html       -> статикой готовый HTML-отчёт Opus (см. ниже)
POST /api/logs/clear          -> очистить лог: truncate logs/drill.log + событие log_cleared
```
**Исключение из CQRS:** готовый **HTML-отчёт** отдаётся **статикой** `/reports/{id}.html` (файл
на диске, не live). Живое дерево — строго на `/ws`; отчёт просто файл, открываемый в новой
вкладке (ссылка `report_link` приходит в node-дельте, список — в `report`-событиях).

---

## 8. task-worker-mcp (форк)

Layout (src-layout, как `assistant-mcp`):
```
task-worker-mcp/
  pyproject.toml            # name=taskworker; deps: mcp>=1.2.0, redis>=5; script taskworker=taskworker.cli:main
  prompts/{classify,score,analyze}.md   # ГОТОВО
  src/taskworker/
    cli.py                  # `taskworker mcp` -> stdio FastMCP
    mcp_server.py           # tools watch / submit_result
    redis_bridge.py         # BRPOP taskq / LPUSH result:{id}
    core/config.py, logsetup.py   # взять из assistant-mcp, выкинуть аудио
```
Инструменты MCP (`FastMCP("taskworker")`, stdio):
- **`watch(max_tasks=10, timeout=30)`** → `[{task_id,type,params,prompt}]`. `BRPOP taskq` (блокирует
  до `timeout`), затем дренит остаток без блокировки до `max_tasks`. Пусто → `[]` (Claude
  повторяет). `prompt` = инлайн текста `prompts/{type}.md`.
- **`submit_result(task_id, result)`** → `LPUSH result:{task_id} {ok:true,result}`; на ошибке
  Claude шлёт `submit_result(task_id, {}, error="…")` → `{ok:false,error}`.

**Берём из `assistant-mcp`:** src-layout `pyproject`, `core/config.py`, `logsetup.py`, скелет
`cli.py`, идиому `mcp_server.py` (FastMCP stdio). **Выкидываем:** `audio/live/engines/hotkeys/
filetranscribe`, `faster-whisper`, `PySide6`, `sounddevice`. **Добавляем:** `redis_bridge.py`,
инструменты watch/submit. Идиома `wait-question` (block-until) превращается в `watch` (BRPOP).

Регистрация у Claude Code (`.mcp.json` в `research/`):
```json
{"mcpServers":{"taskworker":{"command":"conda","args":["run","-n","research3.12","taskworker","mcp"]}}}
```
Workflow Claude (петля): `watch` → по каждому таску `agent(prompt+params, model=по типу,
schema=…)` (пачкой, параллельно) → `submit_result`. Модель на тип — логика workflow, не MCP.

---

## 9. Фронтенд

- **`api.ts`** — вместо `expand()` через HTTP: WS-клиент (`connect`, `subscribe`, `expand`,
  `cmd(op,phrase)` → POST). Реконнект с бэкоффом.
- **`App.tsx`** — вкладки (Главная/Лог/Task/Отчёты); дерево питается snapshot+node-дельтами; кнопки
  по статусу (design §2); `task_id≠null` → disabled узел и поддерево.
- **Диалог подтверждения** `Drill`/`Full load`: перед POST дёргаем `GET /api/estimate` →
  «Загрузит ~N узлов / ~X запросов. Продолжить?» (оценка — нижняя граница по уже загруженному
  поддереву; предупреждаем «может вырасти»).
- **Лог-вкладка** — стрим `log`-событий (+ backlog при открытии) с кнопкой **«Удалить всё»**
  (`POST /api/logs/clear` — чистит и представление, и файл `logs/drill.log`). **Task-вкладка** —
  таблица `task`-событий.
- **Отчёты-вкладка** — таблица `report`-событий (join с `node`): фраза-заголовок, вердикт,
  `verdict_score`, дата, ссылка. **`Link`**-кнопка (на узле — только если есть отчёт
  `report_link`; и в этой вкладке) открывает `report.link` (`/reports/{id}.html`) в НОВОЙ
  вкладке — HTML уже собран Opus.
- Двухцветные `+` (зелёный локальный / синий `⚡` загруженный) — как сейчас.

---

## 10. Порядок реализации (PR-размерные шаги; маппинг на design §10)

| # | Шаг | Готово, когда |
|---|---|---|
| 1 | `wscore.migrate` + backfill (`freq_band`,`status`) | старая БД открывается, колонки/таблицы есть, дерево работает как раньше |
| 2 | Redis up + `celery_app` + пустой worker | `celery -A celery_app worker` стартует, коннектится к Redis |
| 3 | WS `/ws` (snapshot/expand/node) + events-подписчик → **лог-файл** (§6.1) + перевод фронта на чтение с WS | дерево грузится/раскрывается по WS; `log`-события пишутся в `logs/drill.log` |
| 4 | `full_load` Celery-таск + `POST /api/node/full-load` + прогресс в `events` | клик Full load краулит поддерево, статусы капают в дерево в реальном времени |
| 5 | `search` Celery-таск (+`serp`) | `TRANSACTIONAL`→`SEARCHED`, выдача в БД |
| 6 | `task-worker-mcp` форк (watch/submit) + `.mcp.json` + мост Redis | ручной `LPUSH taskq` доходит до Claude и возвращается `submit_result` |
| 7 | `classify` (Sonnet) + `score` (Haiku, порог 60) через workflow | поддерево размечается kind + score, статусы обновляются |
| 8 | `analyze` (Opus 1M) → HTML по `templates/report.html` в `reports/{id}.html` + `report`-таблица + статика `/reports` + вкладка «Отчёты» | `SCORED`→`ANALYZED`, отчёт открывается и есть в списке |
| 9 | `drill`-оркестратор + диалог подтверждения + блокировки/вкладки UI + кнопка **«Удалить всё»** логов | один Drill доводит поддерево до терминалов |

Каждый шаг самодостаточен и проверяем вручную до следующего.

---

## 11. Принятые решения (можешь отменить)

1. **Redis — единственная инфра** (брокер + backend + очередь LLM + pub/sub). Альтернатива
   RabbitMQ тяжелее и не даёт pub/sub-профита; отвергнута. *(Если не хочешь Redis-сервис — можно
   Celery на брокере «filesystem», но тогда pub/sub-шину и очередь задач делаем иначе — скажи.)*
2. **LLM-таски блокируют Celery-тред** (`-P threads -c 12`) ради простой последовательности
   `search→score→analyze`. Fire-and-forget + callback отвергнут (ломает цепочку).
3. **`expand` по WS — чистое чтение;** подгрузка — только явный write (`load`/`full_load`).
   Меняет нынешнее авто-фетч-поведение `/api/expand`.
4. **Report — готовый HTML-файл** `reports/{id}.html` (Opus рендерит по `templates/report.html`),
   отдаётся статикой; таблица `report(id, node FK, link, created_at)` + вкладка «Отчёты»
   (`report JOIN node` → title/вердикт). Ни `node.report_id`, ни JSON-эндпоинта нет.
5. **classify чанкуется по ~120 самодостаточных узлов**; `score` — батчами 8–15.
6. **`drill` — таск-оркестратор**, не Celery-canvas (ветвистое дерево проще вести кодом).
