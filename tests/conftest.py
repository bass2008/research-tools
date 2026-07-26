"""Фикстуры тестов конвейера drill (testing-plan §3).

Главные правила этого файла:

* **Оригинальный `semcore.db` только читаем.** За таблицу `cache` заплачено деньгами, поэтому
  каждый тест работает на копии, снятой sqlite-бэкапом (источник открыт `mode=ro`).
* **Режим «только кэш»** (`XMLRIVER_CACHE_ONLY=1`, testing-plan §1.5): промах кэша не идёт в сеть.
  Сверху сеть заглушена жёстко — любой httpx-вызов из `wscore`/`tasks` валит тест.
* **Сервер поднимается `TestClient`** на подсунутой БД, с временными каталогами `logs/` и
  `reports/`: настоящий `logs/drill.log` и отчёты проекта тесты не трогают.
* **Снимок по статусам** — БД, где есть узел в каждом из 11 статусов (design §2) плюс узел с
  отчётом и узел с ошибкой; на ней проверяются HTTP/WS-контракты и матрица FSM.
"""
import asyncio
import faulthandler
import json
import sqlite3
import sys
import time
from contextlib import ExitStack
from pathlib import Path

import pytest
from fastapi.staticfiles import StaticFiles
from starlette.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import server                      # noqa: E402
import tasks                       # noqa: E402
import wscore                      # noqa: E402

REAL_DB = ROOT / "semcore.db"
TOKEN = "test-internal-token"          # свой INTERNAL_TOKEN: настоящий из .env не нужен
HDR = {"X-Internal-Token": TOKEN}      # заголовок внутренних эндпоинтов (tech §6.3)
HANG_AFTER = 90                        # секунд на тест до принудительного выхода со стеками

# ---------------------------------------------------------------- снимок по статусам

# фраза на каждый статус FSM (design §2) + голова, узел с ошибкой и узел с отчётом
SNAP = {
    "NEW": "фон",
    "LOADED": "убрать фон",
    "FULLY_LOADED": "убрать фон видео",
    "HEAD": "убрать фон фото",                  # FULLY_LOADED, freq > 30000 (голова)
    "TRANSACTIONAL": "убрать фон видео онлайн",
    "SEARCHED": "убрать фон видео бесплатно",
    "SCORED": "убрать фон видео нейросеть",
    "LOW_SCORED": "убрать фон видео телефон",
    "CATEGORY": "убрать фон видео программа",
    "INFORMATIONAL": "как убрать фон видео",
    "NAVIGATIONAL": "убрать фон видео капкут",
    "ANALYZED": "убрать фон видео ai",
    "ERROR": "убрать фон видео 4к",             # TRANSACTIONAL + запись об ошибке
}
SNAP_REPORT_ID = "rep00000000000000000000000000001"
# узлы поддерева «убрать фон видео» — на них проверяются блокировка по предку и classify
SNAP_LEAVES = ("TRANSACTIONAL", "SEARCHED", "SCORED", "LOW_SCORED", "CATEGORY",
               "INFORMATIONAL", "NAVIGATIONAL", "ANALYZED", "ERROR")


def _docs(prefix, n=10):
    return [{"rank": i + 1, "url": f"https://{prefix}{i}.example/page",
             "title": f"{prefix} результат {i + 1}",
             "snippet": f"сниппет {i + 1} для проверки score/analyze"} for i in range(n)]


def seed_snapshot(con):
    """Засеять БД-снимок по статусам. Возвращает SNAP (фраза на каждый статус)."""
    rows = [
        # phrase, freq, status, kind, queried
        (SNAP["NEW"], 41000, "NEW", None, 0),
        (SNAP["LOADED"], 9000, "LOADED", None, 1),
        (SNAP["FULLY_LOADED"], 3000, "FULLY_LOADED", None, 1),
        (SNAP["HEAD"], 45000, "FULLY_LOADED", None, 1),
        (SNAP["TRANSACTIONAL"], 1200, "TRANSACTIONAL", "transactional", 1),
        (SNAP["SEARCHED"], 900, "SEARCHED", "transactional", 1),
        (SNAP["SCORED"], 800, "SCORED", "transactional", 1),
        (SNAP["LOW_SCORED"], 200, "LOW_SCORED", "transactional", 1),
        (SNAP["CATEGORY"], 35000, "CATEGORY", "category", 1),
        (SNAP["INFORMATIONAL"], 400, "INFORMATIONAL", "informational", 1),
        (SNAP["NAVIGATIONAL"], 300, "NAVIGATIONAL", "navigational", 1),
        (SNAP["ANALYZED"], 150, "ANALYZED", "transactional", 1),
        (SNAP["ERROR"], 120, "TRANSACTIONAL", "transactional", 1),
    ]
    for phrase, freq, status, kind, queried in rows:
        con.execute("INSERT OR REPLACE INTO node(phrase, freq, queried, total_refinements, "
                    "status, kind) VALUES (?, ?, ?, 0, ?, ?)", (phrase, freq, queried, status, kind))
    edges = ([(SNAP["NEW"], SNAP["LOADED"]),
              (SNAP["LOADED"], SNAP["FULLY_LOADED"]),
              (SNAP["LOADED"], SNAP["HEAD"])]
             + [(SNAP["FULLY_LOADED"], SNAP[k]) for k in SNAP_LEAVES])
    con.executemany("INSERT OR IGNORE INTO edge(parent, child) VALUES (?, ?)", edges)
    con.execute("UPDATE node SET total_refinements = "
                "(SELECT COUNT(*) FROM edge WHERE parent = node.phrase)")
    # score/verdict у уже оценённых узлов
    con.execute("UPDATE node SET score = 78, competition_yandex = 30, competition_google = 40, "
                "description = 'ищут инструмент, в топе статьи' WHERE phrase = ?",
                (SNAP["SCORED"],))
    con.execute("UPDATE node SET score = 40 WHERE phrase = ?", (SNAP["LOW_SCORED"],))
    con.execute("UPDATE node SET score = 90, verdict = 'BUILD', verdict_score = 88 WHERE phrase = ?",
                (SNAP["ANALYZED"],))
    # узел с ошибкой: статус НЕ менялся, ошибка записана (design §0)
    con.execute("UPDATE node SET error = 'HTTP 500 от XMLRiver (Google)', error_stage = 'search' "
                "WHERE phrase = ?", (SNAP["ERROR"],))
    # выдача там, где она нужна для score/analyze/Search view
    for key in ("SEARCHED", "SCORED", "LOW_SCORED"):
        wscore.save_serp(con, SNAP[key], {"yandex": {"found": 1200, "docs": _docs("yandex")},
                                          "google": {"found": 3400, "docs": _docs("google")}})
    # узел с отчётом
    wscore.save_report(con, SNAP_REPORT_ID, SNAP["ANALYZED"], f"reports/{SNAP_REPORT_ID}.html")
    # журнал задач: одна успешная и одна упавшая — вкладка Task при subscribe
    now = int(time.time())
    con.executemany(
        "INSERT OR REPLACE INTO task(id, type, status, node, params, created_at, started_at, "
        "finished_at, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [("task-done-0001", "analyze", "DONE", SNAP["ANALYZED"], "{}", now - 60, now - 59, now - 10, None),
         ("task-failed-001", "search", "FAILED", SNAP["ERROR"], "{}", now - 40, now - 39, now - 30,
          "RuntimeError: HTTP 500 от XMLRiver (Google)")])
    con.commit()
    return SNAP


# ---------------------------------------------------------------- окружение и сеть

@pytest.fixture(scope="session", autouse=True)
def env_and_no_network():
    """Окружение тестов: «только кэш», свой INTERNAL_TOKEN, ключи-заглушки — и наглухо
    закрытая сеть (промах кэша в режиме cache_only не фетчит, но подстраховаться дешевле)."""
    mp = pytest.MonkeyPatch()
    mp.setenv("XMLRIVER_CACHE_ONLY", "1")
    mp.setenv("INTERNAL_TOKEN", TOKEN)
    mp.setenv("XMLRIVER_USER", "test-user")
    mp.setenv("XMLRIVER_KEY", "test-key")
    mp.setenv("XMLRIVER_YANDEX_URL", "http://127.0.0.1:9/search_yandex/xml")
    mp.setenv("XMLRIVER_GOOGLE_URL", "http://127.0.0.1:9/search/xml")

    def forbidden(*a, **kw):
        raise AssertionError("тест попытался уйти в сеть — это платный вызов XMLRiver")

    mp.setattr(wscore._client, "get", forbidden)
    mp.setattr(tasks._serp_client, "get", forbidden)

    # предохранитель: боевой semcore.db можно открывать только на чтение (cache оплачен).
    # Нужен потому, что путь к БД зашит в значения по умолчанию (_redirect_db) — промах в
    # подмене иначе прошёл бы незамеченным и тест писал бы в боевые данные.
    real_connect = sqlite3.connect

    def guarded_connect(database, *a, **kw):
        text = str(database)
        if Path(text.split("?", 1)[0].removeprefix("file:")) == REAL_DB and "mode=ro" not in text:
            raise AssertionError(f"тест открыл боевой {REAL_DB.name} не только на чтение")
        return real_connect(database, *a, **kw)

    mp.setattr(sqlite3, "connect", guarded_connect)
    yield
    mp.undo()


@pytest.fixture(autouse=True)
def reset_counters():
    """Счётчик реальных сетевых обращений — свой на каждый тест."""
    wscore.reset_net_calls()
    yield
    assert wscore.net_calls() == 0, "тест сходил в сеть — платный вызов XMLRiver"


@pytest.fixture(autouse=True)
def no_hang():
    """Предохранитель от зависаний: тесты вокруг WebSocket и блокирующего `watch` умеют
    ждать вечно, а зависший прогон хуже упавшего — печатаем стеки и выходим."""
    faulthandler.dump_traceback_later(HANG_AFTER, exit=True)
    yield
    faulthandler.cancel_dump_traceback_later()


# ---------------------------------------------------------------- базы данных

def copy_real_db(dst):
    """Копия боевой БД sqlite-бэкапом. Источник открыт только на чтение: cache оплачен."""
    src = sqlite3.connect(f"file:{REAL_DB}?mode=ro", uri=True)
    out = sqlite3.connect(str(dst))
    try:
        src.backup(out)
    finally:
        out.close()
        src.close()
    return Path(dst)


def open_probe(db_path):
    """Отдельное соединение теста (WAL позволяет читать/писать сбоку от сервера)."""
    con = sqlite3.connect(str(db_path), timeout=30)
    con.row_factory = sqlite3.Row
    return con


def _redirect_db(mp, db_path):
    """Подсунуть путь к БД всему коду.

    ВАЖНО: `DB_PATH` попал в значения по умолчанию (`connect`, `_cache_con`, `fetch_phrase`)
    ещё в момент импорта, поэтому подмены модульной константы НЕ ХВАТАЕТ — `wscore.connect()`
    без аргументов всё равно открыл бы боевой `semcore.db` (за него заплачено). Правим и
    `__defaults__`."""
    p = Path(db_path)
    mp.setattr(wscore, "DB_PATH", p)
    mp.setattr(wscore.connect, "__defaults__", (p, True))
    mp.setattr(wscore._cache_con, "__defaults__", (p,))
    mp.setattr(wscore.fetch_phrase, "__defaults__", (wscore.LIMIT, p))


@pytest.fixture
def real_db(tmp_path, monkeypatch):
    """Путь к копии боевой БД (со всем накопленным cache и деревом)."""
    path = copy_real_db(tmp_path / "semcore-copy.db")
    _redirect_db(monkeypatch, path)
    return path


@pytest.fixture
def empty_db(tmp_path, monkeypatch):
    """Путь к пустой БД: схема ещё не заведена, cache пуст (бэкфиллу нечего делать)."""
    path = tmp_path / "empty.db"
    _redirect_db(monkeypatch, path)
    return path


@pytest.fixture
def snapshot_db(tmp_path, monkeypatch):
    """Путь к БД-снимку по статусам."""
    path = tmp_path / "snapshot.db"
    _redirect_db(monkeypatch, path)
    con = wscore.connect(path)
    seed_snapshot(con)
    con.close()
    return path


@pytest.fixture
def snap_con(snapshot_db):
    """Соединение теста к БД-снимку (сбоку от серверного)."""
    con = open_probe(snapshot_db)
    yield con
    con.close()


# ---------------------------------------------------------------- поднятый сервер

@pytest.fixture
def logs_dir(tmp_path):
    d = tmp_path / "logs"
    d.mkdir(exist_ok=True)
    return d


@pytest.fixture
def reports_dir(tmp_path):
    d = tmp_path / "reports"
    d.mkdir(exist_ok=True)
    return d


@pytest.fixture
def serve(monkeypatch, logs_dir, reports_dir):
    """Фабрика поднятого сервера: serve(db_path) -> TestClient (lifespan уже прошёл).

    Лог и отчёты уводим в tmp; статику /reports перемонтируем, потому что каталог в Mount
    зафиксирован в момент импорта server.py."""
    stack = ExitStack()

    def _serve(db_path):
        _redirect_db(monkeypatch, db_path)
        monkeypatch.setattr(server, "LOGS", logs_dir)
        monkeypatch.setattr(server, "LOG_FILE", logs_dir / "drill.log")
        monkeypatch.setattr(server, "REPORTS", reports_dir)
        monkeypatch.setattr(tasks, "REPORTS", reports_dir)
        for route in server.app.routes:
            if getattr(route, "path", None) == "/reports":
                monkeypatch.setattr(route, "app", StaticFiles(directory=str(reports_dir),
                                                              html=True, check_dir=False))
        return stack.enter_context(TestClient(server.app))

    yield _serve
    stack.close()


@pytest.fixture
def client(serve, snapshot_db):
    """Сервер на БД-снимке по статусам."""
    return serve(snapshot_db)


@pytest.fixture
def log_file(logs_dir):
    return logs_dir / "drill.log"


@pytest.fixture
def llm_timeout(monkeypatch):
    """Укоротить ожидание LLM: llm_timeout(1.5) -> таймаут операции ~1.5 с."""
    def _set(base, extra=0.0):
        monkeypatch.setattr(tasks, "LLM_TIMEOUT",
                            {t: (base, extra) for t in tasks.LLM_TYPES})
        return base
    return _set


@pytest.fixture
def fetch_spy(monkeypatch):
    """Счётчик обращений к пулу фразы (сеть ИЛИ кэш) — «повторный краул не тратит фетчей»."""
    calls = []
    real = wscore.fetch_phrase

    def spy(phrase, limit=wscore.LIMIT, db_path=None):
        calls.append(wscore.normalize(phrase))
        return real(phrase, limit, db_path or wscore.DB_PATH)

    monkeypatch.setattr(wscore, "fetch_phrase", spy)
    return calls


# ---------------------------------------------------------------- утилиты ожидания

def wait_for(fn, timeout=10.0, step=0.02, what="условие"):
    """Дождаться истинного значения fn() — без пауз «на глазок» (testing-plan §8)."""
    deadline = time.monotonic() + timeout
    while True:
        value = fn()
        if value:
            return value
        if time.monotonic() > deadline:
            raise AssertionError(f"не дождались: {what}")
        time.sleep(step)


NODE_KEYS = {"phrase", "freq", "status", "kind", "score", "verdict", "verdict_score",
             "task_id", "error", "cached", "childCount"}
PING = "сигнальная фраза конца очереди"


def recv(ws):
    """Один конверт {type, data} (tech §6.2)."""
    env = ws.receive_json()
    assert set(env) == {"type", "data"}, f"конверт события испорчен: {env!r}"
    return env["type"], env["data"]


def drain(ws):
    """Всё, что сервер уже положил в очередь клиента. Конец помечаем «пингом» `expand`:
    очередь у клиента одна и FIFO, поэтому его ответ придёт последним — тест не зависает
    на `receive` в ожидании события, которого не будет."""
    ws.send_json({"action": "expand", "phrase": PING})
    out = []
    while True:
        kind, data = recv(ws)
        if kind == "children" and data["parent"] == PING:
            return out
        out.append((kind, data))


def only(events, kind):
    """Данные событий одного типа из списка, собранного drain()."""
    return [d for k, d in events if k == kind]


def check_node(obj):
    """Объект узла — ровно поля контракта tech §6.2."""
    assert NODE_KEYS <= set(obj), f"в объекте узла нет полей: {NODE_KEYS - set(obj)}"
    assert set(obj) <= NODE_KEYS | {"report_link", "children"}, f"лишние поля: {obj}"
    assert isinstance(obj["freq"], int) and obj["status"] in wscore.STATUSES
    return obj


def task_row(con, task_id):
    r = con.execute("SELECT * FROM task WHERE id = ?", (task_id,)).fetchone()
    return dict(r) if r else None


def task_done(con, task_id, timeout=10.0):
    """Дождаться терминального статуса задачи. -> строка task."""
    return wait_for(lambda: (lambda r: r if r and r["status"] in ("DONE", "FAILED") else None)
                    (task_row(con, task_id)), timeout=timeout, what=f"задача {task_id} завершилась")


def node_row(con, phrase):
    r = con.execute("SELECT * FROM node WHERE phrase = ?", (wscore.normalize(phrase),)).fetchone()
    return dict(r) if r else None


def log_lines(path, timeout=0.0, contains=None):
    """Строки лог-файла (писатель асинхронный, поэтому с ожиданием при необходимости)."""
    def read():
        if not Path(path).exists():
            return []
        return Path(path).read_text(encoding="utf-8").splitlines()
    if contains is None:
        if timeout:
            wait_for(read, timeout=timeout, what="лог-файл не пуст")
        return read()
    return wait_for(lambda: [ln for ln in read() if contains in ln] or None,
                    timeout=timeout or 10.0, what=f"строка лога {contains!r}")


def counts(con):
    """Снимок объёмов таблиц — для проверок «ничего не изменилось»."""
    out = {}
    for t in ("cache", "keywords", "node", "edge", "serp", "task", "report"):
        try:
            out[t] = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        except sqlite3.OperationalError:
            out[t] = None
    return out


def table_rows(con, table):
    """Все строки таблицы как отсортированный список кортежей (побайтовая сверка)."""
    return sorted(tuple(r) for r in con.execute(f"SELECT * FROM {table}"))


# ---------------------------------------------------------------- рантайм без сервера

class StubCtx:
    """Минимальный рантайм для прямого вызова операций `tasks.*` без HTTP и без LLM.

    Та же БД и тот же код операции, но события/лог складываются в списки, а ответы LLM
    отдаёт функция `answer(job)` (может бросить исключение — это «отказ агента»)."""

    def __init__(self, con, answer=None):
        self.con = con
        self.db = wscore.db_path_of(con)
        self.events = []
        self.logs = []
        self.jobs = []
        self.answer = answer
        self.net = asyncio.Semaphore(4)
        self.crawl = asyncio.Semaphore(1)
        self.running = set()
        self.llm = self
        self._locks = {}

    # --- шина событий и лог ---

    def publish(self, kind, data):
        self.events.append((kind, data))
        return {"type": kind, "data": data}

    def log(self, level, stage, node, msg):
        row = {"ts": time.strftime(server.TS_FMT), "level": level, "stage": stage or "",
               "node": node or "", "msg": str(msg)}
        self.logs.append(row)
        return row

    def spawn(self, coro):
        t = asyncio.ensure_future(coro)
        self.running.add(t)
        t.add_done_callback(self.running.discard)
        return t

    # --- блокировки ---

    def acquire(self, phrases, task_id):
        for p in phrases:
            self._locks.setdefault(p, []).append(task_id)

    def release(self, phrases, task_id):
        for p in phrases:
            stack = self._locks.get(p) or []
            if task_id in stack:
                stack.remove(task_id)
            if not stack:
                self._locks.pop(p, None)

    def busy(self, phrase):
        return phrase if self._locks.get(phrase) else None

    # --- обмен с LLM ---

    def llm_online(self):
        return True

    async def run(self, jobs, timeout, on_done=None):
        self.jobs += jobs
        out = []
        for i, job in enumerate(jobs, 1):
            out.append(self.answer(job) if self.answer else {})
            if on_done:
                on_done(i)
        return out

    # --- удобства теста ---

    def events_of(self, kind):
        return [d for k, d in self.events if k == kind]

    def logs_of(self, level=None):
        return [r for r in self.logs if level is None or r["level"] == level]

    def text(self):
        return "\n".join(f"{r['level']} {r['stage']} {r['node']} {r['msg']}" for r in self.logs)


def covered_roots(con, floor=wscore.FLOOR, min_nodes=2):
    """Корни поддеревьев, ПОЛНОСТЬЮ покрытых кэшем (testing-plan §3.1).

    Покрыто = каждый узел, который краул стал бы фетчить (сам корень и всё с `freq >= floor`),
    уже лежит в `cache`. Поддерево считаем по правилам краула: ниже `floor` вглубь не идём,
    поэтому набор фраз совпадает с тем, что даст настоящий `crawl_subtree`. Выбираем запросом,
    а не хардкодом: список зависит от текущего кэша. -> [(корень, [фразы], фетчей, глубина)],
    сначала самые глубокие."""
    kids = {}
    for parent, child in con.execute("SELECT parent, child FROM edge"):
        kids.setdefault(parent, []).append(child)
    freq = {p: (f or 0) for p, f in con.execute("SELECT phrase, COALESCE(freq, 0) FROM node")}
    cached = {r[0] for r in con.execute("SELECT query FROM cache")}
    out = []
    for root in cached:
        phrases, depth = [root], {root: 0}
        queue = [root]
        while queue:
            p = queue.pop(0)
            if p != root and freq.get(p, 0) < floor:
                continue                       # лист: краул ниже FLOOR не бурит
            for child in kids.get(p, ()):
                if child not in depth:
                    depth[child] = depth[p] + 1
                    phrases.append(child)
                    queue.append(child)
        need = [p for p in phrases if p == root or freq.get(p, 0) >= floor]
        if len(phrases) >= min_nodes and all(p in cached for p in need):
            out.append((root, phrases, len(need), max(depth.values())))
    out.sort(key=lambda x: (-x[3], -len(x[1])))
    return out


def wipe_model(con):
    """Снести модель, оставив cache (testing-plan §3.1, второй уровень сброса).

    Внимание: `wscore.connect()` на пустом `node` и непустом `cache` сам пересобирает модель,
    поэтому после сноса работаем ЭТИМ соединением (или подключаемся с `backfill=False`)."""
    con.execute("DELETE FROM edge")
    con.execute("DELETE FROM node")
    con.commit()


def reset_subtree(con, root):
    """Вернуть поддерево в состояние «не загружено», не трогая остальную модель: узлы
    становятся NEW и queried=0, их рёбра удаляются. Нужно, чтобы краул через сервер шёл
    настоящим кодом (модель непуста -> бэкфилл не срабатывает). -> фразы поддерева до сброса."""
    phrases = wscore.subtree_phrases(con, root)
    for chunk in [phrases[i:i + 400] for i in range(0, len(phrases), 400)]:
        qs = ",".join("?" * len(chunk))
        con.execute(f"UPDATE node SET queried = 0, total_refinements = 0, status = 'NEW' "
                    f"WHERE phrase IN ({qs})", chunk)
        con.execute(f"DELETE FROM edge WHERE parent IN ({qs})", chunk)
    con.commit()
    return phrases


def seed_cache(con, pools):
    """Засеять cache «ответами XMLRiver»: pools = {фраза: [(дочерняя фраза, freq), …]}.

    Своя частота фразы берётся из pools, если фраза есть среди своих же детей, иначе
    считается как сумма — форма ответа та же, что у настоящего XMLRiver (`popular`)."""
    for phrase, kids in pools.items():
        qn = wscore.normalize(phrase)
        own = next((f for p, f in kids if wscore.normalize(p) == qn), None)
        popular = [{"text": qn, "value": own if own is not None else sum(f for _, f in kids)}]
        popular += [{"text": wscore.normalize(p), "value": f} for p, f in kids
                    if wscore.normalize(p) != qn]
        con.execute("INSERT OR REPLACE INTO cache(query, response, ts) VALUES (?, ?, ?)",
                    (qn, json.dumps({"popular": popular}, ensure_ascii=False), int(time.time())))
    con.commit()
