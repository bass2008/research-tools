# Codex-диспетчер `taskworker`

Этот каталог — точка запуска LLM-конвейера ниш моделями Codex. Не используй Claude CLI,
Claude-сессии и `~/.claude/agents/*`.

`README.md` здесь и `../task-worker-mcp/prompts/orchestrator.md` пока описывают старый Claude
harness. Не исполняй из них команды `claude ...` и не редактируй их без отдельной просьбы.

## Главное правило запуска

На просьбу «запусти», «запусти воркер» или «запусти диспетчер» используй только встроенную
команду установленного пакета:

```bash
/home/sergey/miniconda3/envs/research3.12/bin/taskworker codex-dispatch start \
  --fast --max-workers 8
```

Никаких runtime-скриптов создавать не надо. Не пиши `supervisor.py`, shell-loop, systemd unit или
временный Python-файл. Реализация уже находится в
`../task-worker-mcp/src/taskworker/codex_dispatch.py` и запускается через общий entry point
`taskworker`.

`start` сам:

- проверяет наличие Codex CLI;
- проверяет user-scope MCP `taskworker` и регистрирует его, если регистрации ещё нет;
- не перезаписывает чужую регистрацию с тем же именем;
- запускает один фоновый dispatcher с singleton-lock;
- делает начальный `watch` и возвращает успех только после подтверждённой связи с FastAPI;
- хранит PID, lock, ledger и логи в `../logs/codex-dispatcher/`;
- поднимает отдельный `codex exec` на каждый полученный джоб.

Если `taskworker --help` не показывает `codex-dispatch`, пакет установлен не из актуального
checkout. Исправление:

```bash
cd /home/sergey/Personal/research-tools
/home/sergey/miniconda3/envs/research3.12/bin/pip install -e task-worker-mcp
```

Не запускай сервер приложения автоматически. Если начальный `watch` не проходит, сообщи точную
ошибку: сервер, `APP_URL`, `INTERNAL_TOKEN`, Codex auth или MCP.

## Проверка существующего экземпляра

Перед `start` выполни:

```bash
/home/sergey/miniconda3/envs/research3.12/bin/taskworker codex-dispatch status --json
```

Если получены `"alive": true` и `"status": "running"`, ничего больше не запускай. Сообщи PID,
tier, `parallel_limit`, `last_watch_at` и счётчики `running`/`pending`.

Если статус `stale`, `failed`, `degraded` либо процесс не жив, посмотри:

```bash
tail -n 50 ../logs/codex-dispatcher/dispatcher.log
tail -n 50 ../logs/taskworker.log
tail -n 50 ../logs/drill.log
```

После диагностики используй штатные `stop` и `start`; не удаляй PID/lock вручную и не запускай
второй `wait-jobs`.

Успех запуска подтверждают одновременно:

- команда `start` завершилась с кодом 0;
- `status --json` показывает живой PID и `status: running`;
- `last_watch_at` создан после запуска;
- в `drill.log` есть свежий внутренний `watch` от диспетчера.

Одна MCP-регистрация, PID-файл или процесс Codex сами по себе успех не доказывают.

## Остановка

На явную просьбу остановить dispatcher выполни:

```bash
/home/sergey/miniconda3/envs/research3.12/bin/taskworker codex-dispatch stop
/home/sergey/miniconda3/envs/research3.12/bin/taskworker codex-dispatch status --json
```

`stop` проверяет точный PID и останавливает только встроенный dispatcher. Уже запущенные
исполнители по умолчанию заканчивают взятые джобы: одноразовый сигнал уже снят, и их убийство
приведёт серверную операцию к таймауту.

Не используй `pkill`, `killall` и широкие фильтры по `python`, `codex`, `taskworker` или `cwd`:
рядом могут работать пользовательские сессии.

## Архитектура и роли

`taskworker` — один кросс-клиентный stdio MCP-сервер на `mcp.server.fastmcp.FastMCP`. `FastMCP`
означает Python-обвязку Model Context Protocol и не имеет отношения к Codex Fast mode.

Инструменты:

| Инструмент | Кто вызывает | Что делает |
|---|---|---|
| `status` | интерактивная диагностика | проверяет сервер, но может снять ожидающие сигналы |
| `get_job(job_id)` | только исполнитель джоба | получает `{job_id, type, params, prompt}` |
| `submit_result(...)` | только исполнитель джоба | возвращает результат или ошибку |

Dispatcher никогда не вызывает `get_job` и не читает payload. Через его память проходят только
`job_id` и `type`. Полный вход получает отдельный процесс Codex.

Сигнал из `status` и `wait-jobs` одноразовый. Поэтому:

- не запускай внешний `taskworker wait-jobs` рядом со встроенным dispatcher;
- не вызывай MCP `status` как безобидную проверку здоровья;
- если вручную уже получил `{job_id,type}`, не жди повторного сигнала и не читай payload в
  диспетчере — передай id отдельному исполнителю;
- один джоб исполняется одним процессом Codex;
- джобы `adjacent` с `:0`, `:1`, `:2` — независимые джобы;
- упавший джоб не ретраится автоматически, но не останавливает общую петлю.

Durable ledger записывается до запуска модели. После падения dispatcher незапущенные `pending`
можно продолжить; живой `running` второй раз не запускается. Если Codex-процесс исчез до
`submit_result`, dispatcher отправляет серверу lifecycle-error вместо ожидания полного таймаута.

## Модели исполнителей

Модель и reasoning задаются встроенным dispatcher явно:

| `type` | Codex-модель | effort |
|---|---|---|
| `needs` | `gpt-5.6-sol` | `xhigh` |
| `needs_refine` | `gpt-5.6-sol` | `xhigh` |
| `needs_rank` | `gpt-5.6-sol` | `xhigh` |
| `analyze_work` | `gpt-5.6-sol` | `xhigh` |
| `analyze_adv` | `gpt-5.6-sol` | `xhigh` |
| `analyze_product` | `gpt-5.6-sol` | `xhigh` |
| `model_test` | `gpt-5.6-luna` | `low` |
| `season` | `gpt-5.6-terra` | `low` |
| `adjacent` | `gpt-5.6-terra` | `medium` |
| `stopwords` | `gpt-5.6-terra` | `low` |

Неизвестный новый тип получает безопасный fallback `gpt-5.6-sol/xhigh`; его `prompt` остаётся
источником истины.

`--fast` явно передаёт каждому `codex exec`:

```text
features.fast_mode=true
service_tier="fast"
```

В runtime Codex этот tier называется `priority`. Fast не наследуется неявно из живого
родительского TUI и не меняет model/effort — только скорость и расход кредитов. Если пользователь
явно просит Standard, запусти без `--fast`; смешивать tier внутри одного экземпляра нельзя.

## Контракт исполнителя

Каждый процесс `codex exec` обязан:

1. вызвать `taskworker.get_job(job_id)` только для выданного id;
2. проверить фактические `job_id` и `type`;
3. выполнить серверное поле `prompt` строго и полностью — не подменять его файлами репозитория;
4. вернуть валидный JSON без обрезки массивов, HTML и обязательных полей;
5. если объявлен `result_file`, записать JSON ровно туда и вызвать `submit_result(job_id)` без
   `result`; свой путь не выбирать;
6. считать успехом только `accepted:true`;
7. исправить и повторно отправить тот же ответ только при `accepted:false` с конкретными
   `problems`; unknown/expired не ретраить;
8. при невозможности достоверного ответа отправить `error`, а не выдуманные данные;
9. не менять БД и файлы проекта, кроме объявленного `result_file`;
10. не запускать субагентов: параллелизм уже обеспечивается процессом на каждый джоб.

## Локальные лабораторные джобы

`local-needs-*` не появляется в серверном `watch`. Если пользователь прямо дал такой `job_id`,
запусти один отдельный `codex exec` по тому же контракту, но не запускай из-за этого постоянный
dispatcher. Вход и результат находятся в объявленных `input_file`/`result_file`.

## Границы

- Обычный запуск не меняет код проекта, БД или сервер.
- Runtime-файлы допустимы только в `../logs/codex-dispatcher/`; исполняемый код там не создаётся.
- Не вызывай `/internal/test/enqueue-job` в боевой работе.
- Не читай и не печатай `.env`/`INTERNAL_TOKEN`; их загружает `taskworker`.
- `codex mcp list` подтверждает регистрацию, но не доступность FastAPI; для этого нужен `watch`.
- Пользователю сообщай PID, Fast/Standard, лимит, свежесть `watch`, active/pending и проверенную
  ошибку при degraded/failed.
