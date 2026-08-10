#!/usr/bin/env python3
"""
FastAPI-сервер конвейера drill: команды (HTTP), чтение (WebSocket), очередь фоновых
задач, шина событий, внутренние эндпоинты для task-worker-mcp и статика.

Решения, которые здесь зафиксированы (tech-design §2, §6):
- всё серверное живёт в одном процессе на asyncio; брокера и воркеров нет;
- единственное соединение с БД используется ТОЛЬКО из event-loop-треда, блокирующая
  сеть уходит в executor (см. tasks.py);
- команда ставит задачу, вешает node.task_id и сразу отвечает ack {task_id};
- ожидание LLM не блокирует разбор очереди: каждая задача — своя корутина;
- чтение по WS ничего не подгружает (CQRS): root/expand — чистая проекция модели;
- логи дублируются в logs/drill.log теми же полями, что в событии log.

Запуск: conda run -n research3.12 uvicorn server:app --port 8000
"""
import asyncio
import json
import os
import time
from collections import deque
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, Header, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import needs_layer
import tasks
import wscore

ROOT = Path(__file__).parent
LOGS = ROOT / "logs"
LOG_FILE = LOGS / "drill.log"
REPORTS = tasks.REPORTS
DIST = ROOT / "frontend" / "dist"

LOG_TAIL = 300            # строк хвоста лога отдаём клиенту при subscribe
LOG_SEP = " · "           # формат строки: время · уровень · стадия · узел · сообщение
TS_FMT = "%Y-%m-%dT%H:%M:%S"
LLM_OFFLINE_AFTER = 240   # нет watch дольше 4 минут -> петля offline (tech §6 «Правила»).
                          # Порог терпимый специально: пока диспетчер раздаёт агентов,
                          # висящего watch нет, и при коротком пороге индикатор мигал.
LLM_CHECK_EVERY = 10
XMLRIVER_LIMIT = 4        # одновременных обращений к XMLRiver вне краула
CRAWL_LIMIT = 1           # одновременных краулов (внутри каждого — wscore.WORKERS фетчей)
CLIENT_QUEUE = 5000       # события на клиента; переполнилось — клиент слишком медленный
ROOTS_LIMIT = 50
MODEL_FAMILIES = ("claude", "codex")

# кто может дёрнуть операцию из текущего статуса (design §2, «Кнопки по статусу»)
ALLOWED = {
    "load": ("NEW",),
    "full_load": ("NEW", "LOADED"),
}
ERRORS = {401: "unauthorized", 404: "not_found", 409: "conflict", 422: "invalid"}

CTX = None   # рантайм процесса, создаётся в lifespan


# ---------- шина событий, блокировки, состояние LLM ----------

class Ctx:
    """Рантайм: БД, шина событий, очередь задач, семафоры, обмен с LLM, блокировки узлов."""

    def __init__(self, con):
        self.con = con
        self.db = wscore.db_path_of(con)
        self.clients = set()                       # очереди WS-клиентов
        self.log_q = asyncio.Queue()               # строки для писателя лог-файла
        self.queue = asyncio.Queue()               # очередь задач: task_id
        self.net = asyncio.Semaphore(XMLRIVER_LIMIT)
        self.crawl = asyncio.Semaphore(CRAWL_LIMIT)
        self.llm = LlmBroker(self)
        self.last_watch = {f: 0.0 for f in MODEL_FAMILIES}  # последний watch каждого семейства
        self.watchers = {f: 0 for f in MODEL_FAMILIES}      # висящие watch каждого семейства
        self.running = set()                       # живые корутины задач (иначе их съест GC)
        self.task_runs = {}                        # task_id -> корутина: нужна для отмены
        self.cancelled = set()                     # отменённые вручную: отличить от рестарта
        self._locks = {}                           # phrase -> стек task_id (drill + его шаги)
        self.needs_busy = set()                    # (дерево, работа) — разбор уже идёт
        self._online = {f: None for f in MODEL_FAMILIES}

    # --- шина событий ---

    def publish(self, kind, data):
        """Конверт {type, data} — каждому WS-клиенту (tech §6.2)."""
        env = {"type": kind, "data": data}
        for q in list(self.clients):
            try:
                q.put_nowait(env)
            except asyncio.QueueFull:
                pass
        return env

    def log(self, level, stage, node, msg):
        """Строка лога: событие log + запись в файл (одинаковые поля, tech §6).
        ts — локальное время в ISO-форме: и человеку читаемо, и Date.parse на фронте."""
        row = {"ts": time.strftime(TS_FMT), "level": level,
               "stage": stage or "", "node": node or "", "msg": str(msg)}
        self.publish("log", row)
        self.log_q.put_nowait(row)
        return row

    def spawn(self, coro):
        """Фоновая корутина со ссылкой в ctx.running (иначе задачу соберёт GC)."""
        t = asyncio.ensure_future(coro)
        self.running.add(t)
        t.add_done_callback(self.running.discard)
        return t

    # --- блокировки узлов (tech §6 «Правила») ---

    def _write_lock(self, phrase, task_id):
        try:
            self.publish("node", wscore.set_status(self.con, phrase, None, task_id=task_id))
        except KeyError:
            pass   # узла нет (тестовая задача без узла) — блокировать нечего

    def acquire(self, phrases, task_id):
        """Занять узлы шагом. Стек владельцев: drill держит корень, а его шаг —
        свой узел; снятие шага возвращает узел предыдущему владельцу."""
        for p in phrases:
            self._locks.setdefault(p, []).append(task_id)
            self._write_lock(p, task_id)

    def release(self, phrases, task_id):
        for p in phrases:
            stack = self._locks.get(p) or []
            if task_id in stack:
                stack.reverse()
                stack.remove(task_id)
                stack.reverse()
            owner = stack[-1] if stack else None
            if not stack:
                self._locks.pop(p, None)
            self._write_lock(p, owner)

    def busy(self, phrase):
        """Занят ли узел сам или любой его предок. -> фраза занятого узла или None."""
        seen = {phrase}
        stack = [phrase]
        while stack:
            p = stack.pop()
            row = self.con.execute("SELECT task_id FROM node WHERE phrase = ?", (p,)).fetchone()
            if row and row[0]:
                return p
            for r in self.con.execute("SELECT parent FROM edge WHERE child = ?", (p,)):
                if r[0] not in seen:
                    seen.add(r[0])
                    stack.append(r[0])
        return None

    # --- состояние LLM-петли ---

    def llm_online(self, family=None):
        """Онлайн конкретного семейства; Basic достаточно любого живого диспетчера."""
        if family is None:
            return any(self.llm_online(f) for f in MODEL_FAMILIES)
        if family not in MODEL_FAMILIES:
            return False
        return self.watchers[family] > 0 or \
            (time.time() - self.last_watch[family]) <= LLM_OFFLINE_AFTER

    def llm_status(self):
        families = {
            family: {"online": self.llm_online(family),
                     "last_seen_at": int(self.last_watch[family]) or None}
            for family in MODEL_FAMILIES
        }
        last = max(self.last_watch.values())
        return {"online": any(v["online"] for v in families.values()),
                "last_seen_at": int(last) or None, "families": families}

    def check_llm(self, force=False):
        """Публикует llm_status при смене состояния (и предупреждение в лог, если offline)."""
        states = {family: self.llm_online(family) for family in MODEL_FAMILIES}
        changed = [f for f in MODEL_FAMILIES if states[f] != self._online[f]]
        if not force and not changed:
            return any(states.values())
        previous = dict(self._online)
        self._online.update(states)
        self.publish("llm_status", self.llm_status())
        for family in changed:
            label = "Claude" if family == "claude" else "Codex"
            if states[family]:
                self.log("INFO", "llm", None, f"{label}-петля на связи")
            elif previous[family] is not None:
                self.log("WARN", "llm", None,
                         f"{label}-петля не приходила за джобами больше "
                         f"{LLM_OFFLINE_AFTER} секунд")
        return any(states.values())


class LlmBroker:
    """Очередь LLM-джобов (tech §3, §6.3): watch отдаёт короткий сигнал, данные выдаются
    отдельно по job_id, результат резолвит ожидание операции. Резервирования и ретраев нет —
    страховка одна: таймаут операции."""

    def __init__(self, ctx):
        self.ctx = ctx
        self.jobs = {}            # job_id -> {job_id, task_id, type, params, prompt, future}
        self.pending = deque()    # job_id, по которым сигнал ещё не выдан
        self.arrival = asyncio.Event()

    def waiting(self):
        return len(self.pending)

    def _add(self, job):
        job["future"] = asyncio.get_running_loop().create_future()
        self.jobs[job["job_id"]] = job
        self.pending.append(job["job_id"])
        self.arrival.set()

    def _drop(self, job_ids):
        """Конец операции (или её таймаут): данные джобов больше недоступны."""
        for jid in job_ids:
            self.jobs.pop(jid, None)
        left = [j for j in self.pending if j in self.jobs]
        self.pending.clear()
        self.pending.extend(left)

    async def watch(self, max_jobs, timeout, model_family=None):
        """Блокируется, пока подходящих джобов нет. Сигнал не содержит полного payload."""
        loop = asyncio.get_running_loop()
        deadline = loop.time() + max(0.0, timeout)
        while True:
            out = []
            skipped = deque()
            # Просматриваем текущую очередь один раз: чужое семейство не снимаем и не даём
            # ему блокировать подходящие джобы, лежащие дальше.
            for _ in range(len(self.pending)):
                jid = self.pending.popleft()
                job = self.jobs.get(jid)
                if not job or job["future"].done():
                    continue
                family = job.get("model_family")
                # Basic-джоб не принадлежит семейству и может быть взят любым диспетчером;
                # модельные анализы получает только диспетчер своего семейства.
                matches = model_family is None or family is None or family == model_family
                if len(out) < max_jobs and matches:
                    out.append({"job_id": jid, "type": job["type"],
                                "model_family": family})
                else:
                    skipped.append(jid)
            self.pending.extendleft(reversed(skipped))
            if out:
                return out
            rest = deadline - loop.time()
            if rest <= 0:
                return []
            self.arrival.clear()
            try:
                await asyncio.wait_for(self.arrival.wait(), rest)
            except asyncio.TimeoutError:
                return []

    def requeue_signals(self, signals):
        """Вернуть не доставленные HTTP-клиенту сигналы в начало очереди."""
        queued = set(self.pending)
        added = 0
        for signal in reversed(signals):
            jid = signal.get("job_id") if isinstance(signal, dict) else None
            job = self.jobs.get(jid)
            if jid and jid not in queued and job and not job["future"].done():
                self.pending.appendleft(jid)
                queued.add(jid)
                added += 1
        if added:
            self.arrival.set()
        return added

    def data(self, job_id):
        """Полные данные джоба или None (неизвестен/просрочен).

        Момент, когда исполнитель забрал данные, — единственная достоверная отметка «работа
        реально началась»: сигнал мог получить диспетчер и не раздать. Поэтому здесь задача
        и переводится из `WAITING` в `RUNNING`."""
        job = self.jobs.get(job_id)
        if job is None or job["future"].done():
            return None
        if not job.get("taken_at"):
            job["taken_at"] = time.time()
            tasks.set_task_status(self.ctx, job["task_id"], "RUNNING")
            self.ctx.log("INFO", "llm", None,
                         f"джоб {job_id} взят исполнителем — задача перешла в RUNNING")
        return {"job_id": job_id, "type": job["type"], "params": job["params"],
                "model_family": job.get("model_family"), "prompt": job["prompt"]}

    def submit(self, job_id, ok, result=None, error=None):
        """Результат от агента. -> accepted: False, если джоб просрочен или неизвестен."""
        job = self.jobs.get(job_id)
        if job is None or job["future"].done():
            return False
        fut = job["future"]
        if not ok:
            fut.set_exception(RuntimeError(f"агент вернул ошибку: {error or 'без описания'}"))
            return True
        if isinstance(result, str):
            try:
                result = json.loads(result)
            except ValueError as e:
                fut.set_exception(ValueError(f"невалидный JSON от агента: {e}"))
                return True
        fut.set_result(result)
        return True

    def submit_delay(self, job_id):
        """Сколько ещё держать тестовый submit, чтобы исполнитель реально жил минуту."""
        job = self.jobs.get(job_id)
        if not job or job.get("type") != "model_test":
            return 0.0
        minimum = (job.get("params") or {}).get("minimum_runtime_seconds", 0)
        try:
            minimum = min(300.0, max(0.0, float(minimum)))
        except (TypeError, ValueError):
            return 0.0
        started = job.get("taken_at") or time.time()
        return max(0.0, minimum - (time.time() - started))

    async def run(self, jobs, timeout, on_done=None):
        """Отправить джобы и дождаться ВСЕХ частей. Любой отказ или таймаут -> исключение.
        Данные джобов живут до выхода отсюда (tech §6.3 «Время жизни джоба»)."""
        loop = asyncio.get_running_loop()
        for j in jobs:
            self._add(j)
        pending = {j["future"] for j in jobs}
        deadline = loop.time() + timeout
        done_n = 0
        try:
            while pending:
                rest = deadline - loop.time()
                if rest <= 0:
                    raise TimeoutError(f"таймаут ожидания результата LLM ({timeout:.0f} c)")
                done, pending = await asyncio.wait(pending, timeout=rest,
                                                   return_when=asyncio.FIRST_COMPLETED)
                if not done:
                    raise TimeoutError(f"таймаут ожидания результата LLM ({timeout:.0f} c)")
                for f in done:
                    f.result()          # ошибка агента / невалидный JSON поднимется здесь
                    done_n += 1
                if on_done:
                    on_done(done_n)
            return [j["future"].result() for j in jobs]
        finally:
            self._drop([j["job_id"] for j in jobs])


async def _watch_connected(broker, request, max_jobs, timeout, model_family=None, poll=0.25):
    """Ждать сигнал, не позволяя отключившемуся long-poll навсегда снять его с очереди."""
    watching = asyncio.create_task(broker.watch(max_jobs, timeout, model_family))
    try:
        while not watching.done():
            if await request.is_disconnected():
                watching.cancel()
                with suppress(asyncio.CancelledError):
                    await watching
                return [], True
            done, _ = await asyncio.wait({watching}, timeout=poll)
            if done:
                break
        jobs = watching.result()
        if jobs and await request.is_disconnected():
            broker.requeue_signals(jobs)
            return [], True
        return jobs, False
    finally:
        if not watching.done():
            watching.cancel()
            with suppress(asyncio.CancelledError):
                await watching


# ---------- фоновые петли процесса ----------

async def dispatcher(ctx):
    """Разбор очереди задач: каждая задача уходит своей корутиной, поэтому ожидание LLM
    не мешает разбирать очередь (tech §2)."""
    while True:
        task_id = await ctx.queue.get()
        run = ctx.spawn(tasks.execute(ctx, task_id))
        ctx.task_runs[task_id] = run
        run.add_done_callback(lambda _, tid=task_id: ctx.task_runs.pop(tid, None))


def log_line(row):
    return LOG_SEP.join((row["ts"], row["level"], row["stage"] or "", row["node"] or "", row["msg"]))


async def log_writer(ctx):
    """Дублирование лога в файл — пишется всегда, даже без открытого браузера (design §9)."""
    while True:
        rows = [await ctx.log_q.get()]
        while not ctx.log_q.empty():
            rows.append(ctx.log_q.get_nowait())
        try:
            LOGS.mkdir(parents=True, exist_ok=True)
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                for r in rows:
                    f.write(log_line(r) + "\n")
        except OSError:
            pass   # лог-файл недоступен — не роняем сервер из-за журнала


async def llm_monitor(ctx):
    """Индикатор петли: помним время последнего watch, дольше минуты -> online:false."""
    while True:
        ctx.check_llm()
        await asyncio.sleep(LLM_CHECK_EVERY)


def log_tail(n=LOG_TAIL):
    """Хвост лог-файла, разобранный в те же поля, что у события log."""
    if not LOG_FILE.exists():
        return []
    try:
        with open(LOG_FILE, encoding="utf-8", errors="replace") as f:
            lines = deque(f, maxlen=n)
    except OSError:
        return []
    out = []
    for line in lines:
        parts = line.rstrip("\n").split(LOG_SEP, 4)
        if len(parts) == 5:
            out.append({"ts": parts[0], "level": parts[1], "stage": parts[2],
                        "node": parts[3], "msg": parts[4]})
    return out


@asynccontextmanager
async def lifespan(app):
    global CTX
    LOGS.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    wscore.load_env()
    con = wscore.connect()
    heads_added = needs_layer.backfill_head_nodes(con)
    freed = wscore.clear_stale_locks(con)   # рестарт не оставляет залипших блокировок
    # инвариант: FULLY_LOADED только если всё поддерево загружено (узлы могли стать
    # незагруженными позже — например при выбрасывании отравленной записи кэша)
    repaired = wscore.repair_fully_loaded(con)
    CTX = Ctx(con)
    app.state.ctx = CTX
    loops = [CTX.spawn(log_writer(CTX)), CTX.spawn(dispatcher(CTX)), CTX.spawn(llm_monitor(CTX))]
    CTX.log("INFO", "server", None,
            f"сервер запущен, снято зависших блокировок: {freed}, "
            f"исправлено ложных FULLY_LOADED: {repaired}, "
            f"входов дополнено головой ветки: {heads_added}")
    try:
        yield
    finally:
        for t in loops:
            t.cancel()
        for t in list(CTX.running):
            t.cancel()
        await asyncio.gather(*CTX.running, *loops, return_exceptions=True)
        con.close()


app = FastAPI(title="Niche finder", lifespan=lifespan)


# ---------- ошибки одним телом {error, detail} ----------

@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse(status_code=exc.status_code,
                        content={"error": ERRORS.get(exc.status_code, "error"),
                                 "detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse(status_code=422, content={"error": "invalid", "detail": str(exc)})


# ---------- команды (tech §6.1) ----------

class PhraseIn(BaseModel):
    phrase: str


def _node_or_404(phrase):
    row = wscore.get_node(CTX.con, phrase)
    if row is None:
        raise HTTPException(404, f"фраза неизвестна: {phrase!r}")
    return row


def _not_stopped_or_422(phrase):
    """Фраза под стоп-словом — покупать нечего: и она сама, и все её уточнения в запрете."""
    hit = wscore.words_of(phrase) & wscore.stop_stems(CTX.con)
    if hit:
        word = next(w["word"] for w in wscore.stopwords(CTX.con)
                    if wscore.stem(w["word"]) in hit)
        raise HTTPException(422, f"фраза под стоп-словом {word!r}: загрузка не имеет смысла — "
                                 f"её уточнения тоже под запретом")


def _free_or_409(phrase):
    busy = CTX.busy(phrase)
    if busy:
        raise HTTPException(409, f"занят операцией узел {busy!r}"
                                 + ("" if busy == phrase else " (предок)"))


def _command(op, phrase, params=None):
    p = wscore.normalize(phrase)
    row = _node_or_404(p)
    _free_or_409(p)
    if row["status"] not in ALLOWED[op]:
        raise HTTPException(422, f"операция {op} недопустима из статуса {row['status']}")
    return {"task_id": tasks.enqueue(CTX, op, p, params)}


@app.post("/api/node/root")
async def cmd_add_root(body: PhraseIn, caller: str = Header(None, alias="X-Caller")):
    """Завести новый корень дерева запросов и сразу загрузить его пул.

    Единственный законный вход для фразы, которой в дереве нет: остальные команды работают
    по уже существующему узлу (иначе на опечатке появлялся бы узел с платными кнопками).
    Корни независимы — общего «главного» корня у дерева нет, их столько, сколько завели."""
    p = wscore.normalize(body.phrase)
    if not p:
        raise HTTPException(422, "пустая фраза")
    if wscore.get_node(CTX.con, p) is not None:
        raise HTTPException(409, f"фраза уже есть в дереве: {p!r}")
    _not_stopped_or_422(p)
    wscore.upsert_node(CTX.con, p)          # частоты нет: её принесёт пул
    CTX.con.commit()
    CTX.publish("node", wscore.node_object(CTX.con, p))
    CTX.log("INFO", "root", p, f"новый корень завёл {_caller(caller, 'ui')}")
    return {"task_id": tasks.enqueue(CTX, "load", p)}


@app.post("/api/node/load")
async def cmd_load(body: PhraseIn):
    return _command("load", body.phrase)


@app.post("/api/node/full-load")
async def cmd_full_load(body: PhraseIn):
    return _command("full_load", body.phrase)


@app.post("/api/logs/clear")
async def cmd_logs_clear():
    """Единственная операция, стирающая лог: чистит и файл, и представление."""
    while not CTX.log_q.empty():
        CTX.log_q.get_nowait()
    try:
        LOGS.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "w", encoding="utf-8"):
            pass
    except OSError as e:
        raise HTTPException(422, f"не удалось очистить лог-файл: {e}")
    CTX.publish("log_cleared", {})
    return {"ok": True}


@app.post("/api/tasks/clear")
async def cmd_tasks_clear():
    """Удалить журнал задач целиком и очистить вкладку у всех клиентов."""
    cur = CTX.con.execute("DELETE FROM task")
    CTX.con.commit()
    CTX.publish("tasks_cleared", {})
    return {"ok": True, "deleted": cur.rowcount}


@app.get("/api/estimate")
async def api_estimate(phrase: str = Query(...)):
    """Нижняя оценка объёма full_load/drill по уже известному поддереву."""
    _node_or_404(wscore.normalize(phrase))
    return wscore.estimate_subtree(CTX.con, phrase)


# ---------- деревья потребностей: второй слой (needs_layer) ----------
#
# Слой файловый: каноническая классификация, её ревизии, отдельный продуктовый рейтинг и
# артефакты разборов работ. Чтение идёт по HTTP, а завершение фоновых операций — через общий
# журнал задач в WS (прецедент — GET /api/estimate).


class NeedsAnalyzeIn(BaseModel):
    """Единица действия: `group` у трёх разборов, `work` у сезонности, смежных, выгрузки и теста."""
    tree_id: str
    work: str = ""
    group: str = ""
    model_family: Literal["claude", "codex"] = "claude"


class NeedsRefineIn(BaseModel):
    tree_id: str
    model_family: Literal["claude", "codex"] = "claude"


class NeedsFavoriteIn(BaseModel):
    """Лайк ставится либо на работу, либо на группу дерева продуктов."""
    tree_id: str
    work: str = ""
    group: str = ""
    favorite: bool


class PhraseIn2(BaseModel):
    phrase: str


@app.post("/api/needs/build")
async def cmd_needs_build(body: PhraseIn2, caller: str = Header(None, alias="X-Caller")):
    """Собрать дерево потребностей по загруженной ветке. Заменяет узловой classify."""
    p = wscore.normalize(body.phrase)
    row = _node_or_404(p)
    if row["status"] != "FULLY_LOADED":
        raise HTTPException(422, f"сборка возможна только из FULLY_LOADED, а узел в {row['status']}")
    busy = CTX.busy(p)
    if busy:
        raise HTTPException(409, f"узел занят операцией: {busy}")
    task_id = tasks.enqueue(CTX, "needs_build", p)
    CTX.log("INFO", "needs_build", p, f"сборку заказал {_caller(caller, 'ui')}")
    return {"task_id": task_id}


# ---------- стоп-слова (design §4.10) ----------


class StopWordsIn(BaseModel):
    words: list[dict]


class StopRemoveIn(BaseModel):
    words: list[str]


def _last_scan():
    """Последнее УДАВШЕЕСЯ предложение: оно живёт в результате задачи, отдельного файла
    у него нет — предложение одноразовое, ценность только у принятого списка."""
    row = CTX.con.execute("SELECT id, node, result, finished_at FROM task "
                          "WHERE type = 'stopwords_scan' AND status = 'DONE' "
                          "ORDER BY finished_at DESC LIMIT 1").fetchone()
    if row is None or not row["result"]:
        return None
    try:
        data = json.loads(row["result"])
    except (ValueError, TypeError):
        return None
    return {"task_id": row["id"], "root": row["node"], "created_at": row["finished_at"],
            "words_seen": data.get("words_seen"), "words_total": data.get("words_total"),
            **{k: data.get(k) or [] for k in wscore.STOP_KINDS}}


@app.get("/api/stopwords")
async def api_stopwords():
    """Сохранённые исключения и последнее предложение модели."""
    return {"saved": wscore.stopwords(CTX.con), "suggestion": _last_scan(),
            "kinds": list(wscore.STOP_KINDS)}


@app.post("/api/stopwords/scan")
async def cmd_stopwords_scan(body: PhraseIn, caller: str = Header(None, alias="X-Caller")):
    """Разобрать слова ветки на стоп-слова, бренды и нежелательное (предложение)."""
    p = wscore.normalize(body.phrase)
    _node_or_404(p)
    _free_or_409(p)
    CTX.log("INFO", "stopwords", p, f"разбор слов заказал {_caller(caller, 'ui')}")
    return {"task_id": tasks.enqueue(CTX, "stopwords_scan", p)}


@app.post("/api/stopwords")
async def cmd_stopwords_add(body: StopWordsIn):
    """Принять слова в список исключений. Принимает человек, а не модель."""
    items = []
    for it in body.words:
        w, k = wscore.normalize(str(it.get("word", ""))), str(it.get("kind", ""))
        if not w:
            raise HTTPException(422, "пустое слово")
        if k not in wscore.STOP_KINDS:
            raise HTTPException(422, f"неизвестная категория: {k!r}")
        items.append((w, k))
    return {"added": wscore.add_stopwords(CTX.con, items),
            "saved": wscore.stopwords(CTX.con)}


@app.delete("/api/stopwords")
async def cmd_stopwords_remove(body: StopRemoveIn):
    """Убрать слова из списка. Модель предложит их снова — отклонённого мы не помним."""
    return {"removed": wscore.remove_stopwords(CTX.con, body.words),
            "saved": wscore.stopwords(CTX.con)}


@app.get("/api/needs/reports")
async def api_needs_reports():
    """Разборы работ по всем деревьям — вкладка «Отчёты». Отчёт принадлежит работе."""
    return {"reports": needs_layer.all_analyses()}


@app.get("/api/needs/trees")
async def api_needs_trees():
    """Список деревьев в папке — строки таблицы вкладки «Дерево потребностей»."""
    return {"trees": needs_layer.rows()}


@app.get("/api/needs/tree/{tree_id}")
async def api_needs_tree(tree_id: str):
    """Одно дерево целиком: работы с частотами фраз и прицепленными разборами.

    `tree_id` не склеиваем с путём — он ключ уже найденного набора файлов, иначе получим
    чтение произвольного файла по строке из запроса."""
    try:
        return needs_layer.detail(tree_id)
    except needs_layer.NeedsError as e:
        raise HTTPException(404 if "дерева нет" in str(e) else 422, str(e))


@app.post("/api/needs/favorite")
async def cmd_needs_favorite(body: NeedsFavoriteIn):
    """Ручное избранное работы или продукта. Хранится отдельно от классификации и рейтинга."""
    tree_id = body.tree_id.strip()
    group_id = (body.group or "").strip()
    if not group_id and not (body.work or "").strip():
        raise HTTPException(422, "нужна работа или группа")
    try:
        name, favorites = needs_layer.set_favorite(
            tree_id, work_name=body.work or None, favorite=body.favorite,
            group_id=group_id or None,
        )
    except needs_layer.NeedsError as e:
        raise HTTPException(404 if "дерева нет" in str(e) else 422, str(e))
    key = "group" if group_id else "work"
    return {key: name, "favorite": body.favorite, "favorites": favorites}


@app.post("/api/needs/refine")
async def cmd_needs_refine(body: NeedsRefineIn,
                           caller: str = Header(None, alias="X-Caller")):
    """Второй проход классификации всего дерева выбранным семейством модели.

    Дерево каноническое и общее для Claude/Codex, поэтому два refine одного дерева и любые
    разборы его работ с refine не идут параллельно. Предыдущая ревизия сохраняется на диске.
    """
    tree_id = body.tree_id.strip()
    try:
        needs_layer.load_tree(tree_id)
        source = needs_layer.load_source(tree_id)
    except needs_layer.NeedsError as e:
        raise HTTPException(404 if "дерева нет" in str(e) else 422, str(e))
    running = [key for key in CTX.needs_busy if key[0] == tree_id]
    if running:
        raise HTTPException(409, "по этому дереву уже идёт второй проход или работа с отчётом")
    key = (tree_id, "", "refine", "shared")
    CTX.needs_busy.add(key)
    params = {"tree_id": tree_id, "model_family": body.model_family}
    task_id = tasks.create_task(CTX, "needs_refine", tree_id, params)
    CTX.queue.put_nowait(task_id)
    CTX.log("INFO", "needs_refine", tree_id,
            f"второй проход {task_id[:8]} поставлен в очередь "
            f"({_caller(caller, 'ui')}), фраз {len(source.get('nodes') or [])}, "
            f"семейство {body.model_family}")
    return {"task_id": task_id}


@app.post("/api/needs/rank")
async def cmd_needs_rank(body: NeedsRefineIn,
                         caller: str = Header(None, alias="X-Caller")):
    """Оценить физическую возможность продукта по принятой классификации, без выдачи."""
    tree_id = body.tree_id.strip()
    try:
        tree, _, _ = needs_layer.load_tree(tree_id)
        source = needs_layer.load_source(tree_id)
    except needs_layer.NeedsError as e:
        raise HTTPException(404 if "дерева нет" in str(e) else 422, str(e))
    running = [key for key in CTX.needs_busy if key[0] == tree_id]
    if running:
        raise HTTPException(409, "по этому дереву уже идёт анализ, второй проход или работа с отчётом")
    if not needs_layer.works(tree):
        raise HTTPException(422, "в классификации нет работ для анализа")
    key = (tree_id, "", "rank", "shared")
    CTX.needs_busy.add(key)
    params = {"tree_id": tree_id, "model_family": body.model_family}
    task_id = tasks.create_task(CTX, "needs_rank", tree_id, params)
    CTX.queue.put_nowait(task_id)
    CTX.log("INFO", "needs_rank", tree_id,
            f"анализ продукта {task_id[:8]} поставлен в очередь "
            f"({_caller(caller, 'ui')}), работ {len(needs_layer.works(tree))}, "
            f"фраз {len(source.get('nodes') or [])}, семейство {body.model_family}")
    return {"task_id": task_id}


@app.post("/api/needs/products")
async def cmd_needs_products(body: NeedsRefineIn,
                             caller: str = Header(None, alias="X-Caller")):
    """«Продукты»: разложить работы ветки в дерево продуктов на трёх масштабах.

    Единица здесь — ВЕТКА, а не работа. Объявлено до `/api/needs/{action}` — иначе `products`
    поймает маршрут действия над группой."""
    tree_id = body.tree_id.strip()
    try:
        tree, _, _ = needs_layer.load_tree(tree_id)
    except needs_layer.NeedsError as e:
        raise HTTPException(404 if "дерева нет" in str(e) else 422, str(e))
    if [key for key in CTX.needs_busy if key[0] == tree_id]:
        raise HTTPException(409, "по этому дереву уже идёт операция")
    if not needs_layer.works(tree):
        raise HTTPException(422, "в классификации нет работ для группировки")
    plan = needs_layer.products_plan(tree_id)
    CTX.needs_busy.add((tree_id, "", "products", "shared"))
    params = {"tree_id": tree_id, "model_family": body.model_family}
    task_id = tasks.create_task(CTX, "needs_products", tree_id, params)
    CTX.queue.put_nowait(task_id)
    CTX.log("INFO", "needs_products", tree_id,
            f"группировка в продукты {task_id[:8]} поставлена в очередь "
            f"({_caller(caller, 'ui')}), работ {len(needs_layer.works(tree))}, "
            f"семейство {body.model_family}; прежних групп {plan['groups']}, "
            f"из них с разборами {plan['with_reports']} ({plan['reports']} отчётов)")
    return {"task_id": task_id, "replacing": plan}


@app.post("/api/needs/{action}")
async def cmd_needs_work(action: str, body: NeedsAnalyzeIn,
                         caller: str = Header(None, alias="X-Caller")):
    """Действие второго и третьего слоёв.

    Три разбора идут по ГРУППЕ дерева продуктов, воронкой от рынка к продукту: `analyze` —
    «Ниша» (можно ли перехватить поисковый трафик), `analyze_adv` — «Функции» (какие функции
    внутри и за что платят), `product` — «Спецификация» (кому, почём, почему купят и сколько).
    По РАБОТЕ остаются `season` (история частоты), `adjacent` (смежные ключи без
    слова-технологии), `dump` (выгрузка топ-10 страницами) и `test` — это факты о спросе и
    служебная проверка, а не суждения о продукте.

    Повторный запуск разрешён: каждый прогон копит свой артефакт, и смысл повтора в том, что
    данных стало больше. Запрещён только ПАРАЛЛЕЛЬНЫЙ прогон той же операции по той же единице."""
    ops = {"analyze": "needs_analyze", "analyze_adv": "needs_analyze_adv",
           "product": "needs_analyze_product", "test": "needs_model_test",
           "season": "needs_season",
           "adjacent": "needs_adjacent", "dump": "needs_dump"}
    if action not in ops:
        raise HTTPException(404, f"нет такого действия: {action}")
    # выгрузка работает по обеим единицам: по группе, если она передана, иначе по работе
    by_group = action in {"analyze", "analyze_adv", "product"} or (
        action == "dump" and bool((body.group or "").strip()))
    tree_id = body.tree_id.strip()
    unit = (body.group or "").strip() if by_group else (body.work or "").strip()
    if not unit:
        raise HTTPException(422, "нужна группа" if by_group else "нужна работа")
    try:
        tree, _, _ = needs_layer.load_tree(tree_id)
        if by_group:
            group = needs_layer.find_group(tree_id, unit)
            count = len(needs_layer.group_input(tree_id, unit, 1)["phrases"])
        else:
            count = len(needs_layer.work_phrases(needs_layer.find_work(tree, unit)))
    except needs_layer.NeedsError as e:
        raise HTTPException(404, str(e))
    model_action = action in {"analyze", "analyze_adv", "product", "test"}
    family = body.model_family if model_action else "basic"
    if any(k[0] == tree_id and k[1] == "" and k[3] == "shared" for k in CTX.needs_busy):
        raise HTTPException(409, "по дереву идёт группировка, анализ или второй проход")
    key = (tree_id, unit if by_group else needs_layer._norm(unit), action, family)
    if key in CTX.needs_busy:
        suffix = f" ({family})" if model_action else ""
        raise HTTPException(409, f"«{action}»{suffix} по {unit!r} уже идёт")
    if not count:
        raise HTTPException(422, f"в {unit!r} нет фраз")
    CTX.needs_busy.add(key)
    label = group.get("name") or unit if by_group else unit
    params = {"tree_id": tree_id, ("group" if by_group else "work"): unit}
    if model_action:
        params["model_family"] = family
    task_id = tasks.create_task(CTX, ops[action], label, params)
    CTX.queue.put_nowait(task_id)
    CTX.log("INFO", ops[action], label,
            f"задача {task_id[:8]} поставлена в очередь ({_caller(caller, 'ui')}), "
            f"дерево {tree_id}, фраз {count}, семейство {family}")
    return {"task_id": task_id}


# ---------- чтение: WebSocket /ws (tech §6.2) ----------

def _snapshot(phrase):
    """Проекция поддерева. Фразы нет в дереве — отдаём `root: null`.

    Раньше на любую строку сочинялся узел `NEW` с частотой 0, и на опечатке вроде «авааав»
    появлялся живой узел с кнопками `Load`/`Full load`/`Drill` — то есть предложение уйти в
    платный запрос по абракадабре. Фронтир (узел есть, но не запрошен) от этого отличается тем,
    что узел в дереве ЕСТЬ; ему и положены кнопки загрузки."""
    obj = wscore.node_object(CTX.con, phrase)
    if obj is None:
        return {"root": None, "missing": phrase, "children": []}
    return {"root": obj, "children": wscore.project(CTX.con, phrase)}


def recent_tasks(limit=200):
    """Последние строки журнала задач — вкладка Task при подписке."""
    rows = CTX.con.execute(
        "SELECT id, type, node, status, model_family, created_at, started_at, finished_at, error "
        "FROM task ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


async def _ws_action(q, req):
    """Действия клиента: subscribe / root / expand. Ничего не подгружают (CQRS)."""
    action = (req.get("action") or "").strip()
    phrase = wscore.normalize(req.get("phrase") or "")
    if action == "subscribe":
        # roots + хвост лога (§6.2), плюс накопленные задачи и отчёты: читать их больше
        # негде — вкладки Task и «Отчёты» живут только на этом канале
        q.put_nowait({"type": "roots", "data": {"roots": wscore.root_candidates(CTX.con, ROOTS_LIMIT)}})
        tail = log_tail()
        if tail:
            q.put_nowait({"type": "log", "data": tail})
        rows = recent_tasks()
        if rows:
            q.put_nowait({"type": "task", "data": rows})
        q.put_nowait({"type": "llm_status", "data": CTX.llm_status()})
    elif action == "root":
        q.put_nowait({"type": "snapshot", "data": _snapshot(phrase)})
    elif action == "expand":
        q.put_nowait({"type": "children",
                      "data": {"parent": phrase, "children": wscore.project(CTX.con, phrase)}})
    else:
        q.put_nowait({"type": "log", "data": {"ts": time.strftime(TS_FMT), "level": "WARN",
                                              "stage": "ws", "node": "",
                                              "msg": f"неизвестное действие: {action!r}"}})


async def _ws_sender(websocket, q):
    while True:
        env = await q.get()
        await websocket.send_text(json.dumps(env, ensure_ascii=False))



NEEDS_WORK_OPS = {"needs_analyze": "analyze", "needs_analyze_adv": "analyze_adv",
                  "needs_analyze_product": "product", "needs_model_test": "test",
                  "needs_season": "season", "needs_adjacent": "adjacent",
                  "needs_dump": "dump"}


@app.post("/api/task/{task_id}/cancel")
async def cmd_task_cancel(task_id: str, caller: str = Header(None, alias="X-Caller")):
    """Снять задачу, которую никто не взял (`WAITING`).

    Отменяем только `WAITING`: джоб лежит в очереди LLM, работы не идёт, и если нужного
    семейства нет на связи, задача просто досидит до таймаута. `RUNNING` не отменяем — агент
    уже работает и вернёт результат, которому некуда лечь."""
    row = CTX.con.execute("SELECT type, node, status FROM task WHERE id = ?",
                          (task_id,)).fetchone()
    if row is None:
        raise HTTPException(404, f"задачи нет: {task_id}")
    if row["status"] != "WAITING":
        raise HTTPException(409, f"отменяем только WAITING, а эта задача в {row['status']}")
    CTX.cancelled.add(task_id)
    run = CTX.task_runs.get(task_id)
    if run is not None:
        run.cancel()      # джобы снимет `LlmBroker.run` в finally, блокировки — `execute`
    else:
        # корутины нет: сервер перезапускали, ждать уже некому — закрываем строку сами
        CTX.cancelled.discard(task_id)
        tasks._finish(CTX, task_id, "FAILED", error="отменена вручную")
    CTX.log("INFO", row["type"], row["node"],
            f"задачу {task_id[:8]} отменил {_caller(caller, 'ui')} — исполнитель её не взял")
    return {"ok": True, "task_id": task_id}


@app.post("/api/task/{task_id}/retry")
async def cmd_task_retry(task_id: str, caller: str = Header(None, alias="X-Caller")):
    """Повторить УПАВШУЮ задачу тем же вызовом, что и в первый раз.

    Перезапуск идёт через ту же ручку, а не мимо неё: иначе повтор обойдёт проверки статуса
    узла и занятости работы и два прогона пойдут параллельно. Старая строка задачи остаётся —
    у повтора свой task_id, история падений не переписывается."""
    row = CTX.con.execute("SELECT type, node, params, status FROM task WHERE id = ?",
                          (task_id,)).fetchone()
    if row is None:
        raise HTTPException(404, f"задачи нет: {task_id}")
    if row["status"] != "FAILED":
        raise HTTPException(409, f"повторяем только упавшую задачу, а эта в {row['status']}")
    op = row["type"]
    try:
        params = json.loads(row["params"]) if row["params"] else {}
    except (ValueError, TypeError):
        params = {}
    if not isinstance(params, dict):
        params = {}
    family = params.get("model_family")
    family = family if family in {"claude", "codex"} else "claude"
    tree_id, work, node = params.get("tree_id"), params.get("work"), row["node"]
    group = params.get("group")
    if op in NEEDS_WORK_OPS:
        if not (tree_id and (work or group)):
            raise HTTPException(422, "в параметрах задачи нет дерева, работы или группы")
        return await cmd_needs_work(
            NEEDS_WORK_OPS[op],
            NeedsAnalyzeIn(tree_id=tree_id, work=work or "", group=group or "",
                           model_family=family), caller)
    if op in {"needs_refine", "needs_rank", "needs_products"}:
        if not tree_id:
            raise HTTPException(422, "в параметрах задачи нет дерева")
        body = NeedsRefineIn(tree_id=tree_id, model_family=family)
        return await {"needs_refine": cmd_needs_refine, "needs_rank": cmd_needs_rank,
                      "needs_products": cmd_needs_products}[op](body, caller)
    if op == "needs_build":
        return await cmd_needs_build(PhraseIn2(phrase=node or ""), caller)
    if op == "stopwords_scan":
        return await cmd_stopwords_scan(PhraseIn(phrase=node or ""), caller)
    if op in {"load", "full_load"}:
        return _command(op, node or "")
    raise HTTPException(422, f"повтор не поддержан для операции {op}")


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    q = asyncio.Queue(maxsize=CLIENT_QUEUE)
    CTX.clients.add(q)
    sender = asyncio.ensure_future(_ws_sender(websocket, q))
    try:
        while True:
            msg = await websocket.receive_text()
            try:
                req = json.loads(msg)
            except ValueError:
                continue
            if isinstance(req, dict):
                await _ws_action(q, req)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        CTX.clients.discard(q)
        sender.cancel()


# ---------- внутренние эндпоинты для task-worker-mcp (tech §6.3) ----------

class ResultIn(BaseModel):
    job_id: str
    ok: bool = True
    result: Any = None
    error: str | None = None


class TestJobIn(BaseModel):
    type: str
    params: Any = None
    model_family: Literal["claude", "codex"] | None = None


def _auth(token):
    want = os.environ.get("INTERNAL_TOKEN")
    if not want or token != want:
        raise HTTPException(401, "неверный или отсутствующий X-Internal-Token")


# кто дёрнул внутренний эндпоинт — из заголовка X-Caller (его шлёт task-worker-mcp).
# Без чтения заголовка правило «диспетчер за данными джоба не ходит» непроверяемо (§1.2).
_CALLERS = {"dispatcher": "диспетчер", "agent": "агент"}


def _caller(x_caller, default):
    if not x_caller:
        return f"{default}?"                 # заголовка нет — не выдаём догадку за факт
    return _CALLERS.get(x_caller.strip().lower(), f"неизвестный ({x_caller})")


@app.get("/internal/llm/watch")
async def llm_watch(request: Request,
                    max_jobs: int = Query(8, ge=1, le=100),
                    timeout: float = Query(300.0, ge=0, le=3600),
                    model_family: Literal["claude", "codex"] | None = Query(default=None),
                    x_internal_token: str | None = Header(default=None),
                    x_caller: str | None = Header(default=None)):
    """Ожидание работы: блокируется, пока джобов нет; отдаёт ТОЛЬКО сигнал без данных.
    Зовёт диспетчер — по этому и различаем вызывающего в логе (testing-plan §1.2)."""
    _auth(x_internal_token)
    # Старый wait-jobs не передавал семейство и исторически был Claude. Такой default даёт
    # мягкое обновление; Codex-dispatcher всегда передаёт `codex` явно.
    family = model_family or "claude"
    CTX.last_watch[family] = time.time()
    CTX.check_llm()
    CTX.watchers[family] += 1
    try:
        jobs, disconnected = await _watch_connected(CTX.llm, request, max_jobs, timeout,
                                                     family)
    finally:
        CTX.watchers[family] -= 1
        CTX.last_watch[family] = time.time()
        CTX.check_llm()
    if disconnected:
        CTX.log("INFO", "llm", None, "watch-клиент отключился; сигнал оставлен в очереди")
    if jobs:
        CTX.log("INFO", "llm", None,
                f"сигнал диспетчеру (watch вызвал: {_caller(x_caller, 'диспетчер')}): "
                + ", ".join(f"{j['job_id']}({j['type']}/{j.get('model_family') or 'basic'})"
                            for j in jobs))
    return jobs


@app.get("/internal/llm/job/{job_id}")
async def llm_job(job_id: str, x_internal_token: str | None = Header(default=None),
                  x_caller: str | None = Header(default=None)):
    """Полные данные джоба. Зовёт агент-исполнитель, не диспетчер (tech §6.3)."""
    _auth(x_internal_token)
    CTX.log("INFO", "llm", None,
            f"внутренний вызов get_job {job_id} (вызвал: {_caller(x_caller, 'агент')})")
    data = CTX.llm.data(job_id)
    if data is None:
        CTX.log("WARN", "llm", None, f"get_job {job_id}: джоб неизвестен или просрочен")
        raise HTTPException(404, f"джоб {job_id} неизвестен или просрочен")
    return data


@app.post("/internal/llm/result")
async def llm_result(body: ResultIn, x_internal_token: str | None = Header(default=None),
                     x_caller: str | None = Header(default=None)):
    """Результат джоба. Зовёт агент-исполнитель. Опоздавший или неизвестный job_id —
    accepted:false и предупреждение в лог; сервер при этом жив."""
    _auth(x_internal_token)
    delay = CTX.llm.submit_delay(body.job_id) if body.ok else 0.0
    if delay > 0:
        CTX.log("INFO", "llm", None,
                f"тестовый джоб {body.job_id}: submit принят к ожиданию ещё {delay:.1f} c")
        await asyncio.sleep(delay)
    accepted = CTX.llm.submit(body.job_id, body.ok, body.result, body.error)
    kind = "результат" if body.ok else f"ошибка ({body.error})"
    who = _caller(x_caller, "агент")
    if accepted:
        CTX.log("INFO", "llm", None,
                f"внутренний вызов result {body.job_id} (вызвал: {who}): {kind} принят")
    else:
        CTX.log("WARN", "llm", None,
                f"внутренний вызов result {body.job_id} (вызвал: {who}): {kind} ОТБРОШЕН — "
                "джоб просрочен или неизвестен")
    return {"accepted": accepted}


@app.post("/internal/test/enqueue-job")
async def test_enqueue_job(body: TestJobIn, x_internal_token: str | None = Header(default=None)):
    """Тестовая постановка джоба с готовыми params — без краула и без LLM (testing-plan §1.1)."""
    _auth(x_internal_token)
    try:
        task_id, job_id = tasks.enqueue_bare_job(CTX, body.type, body.params, body.model_family)
    except ValueError as e:
        raise HTTPException(422, str(e))
    CTX.log("INFO", "llm", None, f"тестовый джоб {job_id} ({body.type}) поставлен в очередь")
    return {"task_id": task_id, "job_id": job_id}


# ---------- статика: отчёты и собранный фронт ----------

# /reports монтируем ДО корня, иначе Mount("/") перехватит путь
app.mount("/reports", StaticFiles(directory=str(REPORTS), html=True, check_dir=False), name="reports")
if DIST.exists():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="app")
