#!/usr/bin/env python3
"""
Ядро проекта: клиент XMLRiver Wordstat с кэшем в SQLite, модель дерева (node/edge)
и слой данных конвейера drill (serp/task/report).

Правила работы с БД (tech-design §5):
- соединение из connect() живёт в event-loop-треде, все записи модели идут из него;
- блокирующие сетевые вызовы уходят в executor: fetch_phrase() открывает там своё
  короткоживущее соединение и трогает ТОЛЬКО таблицу cache;
- cache и keywords не пересоздаются и не чистятся никогда (за cache заплачено),
  node/edge — производная от cache, при смене схемы пересобираются (миграций пока нет).
"""
import asyncio
import inspect
import json
import os
import re
import sqlite3
import threading
import time
from collections import deque
from pathlib import Path

import httpx

ROOT = Path(__file__).parent
BASE_URL = "http://xmlriver.com/wordstat/new/json"
DB_PATH = ROOT / "semcore.db"

FLOOR = 50               # граница рекурсии краула: ниже вглубь не бурим (design §4)
SCORE_THRESHOLD = 60     # score > порога -> SCORED, <= -> LOW_SCORED (design §6.3)
LIMIT = 2000             # весь пул фразы: потолок самого XMLRiver
WORKERS = 6              # одновременных фетчей во время краула
CLASSIFY_CHUNK = 120     # узлов в одном classify-джобе (tech §3)

STATUSES = ("NEW", "LOADED", "FULLY_LOADED", "TRANSACTIONAL", "CATEGORY", "INFORMATIONAL",
            "NAVIGATIONAL", "SEARCHED", "SCORED", "LOW_SCORED", "ANALYZED")
TERMINALS = ("CATEGORY", "INFORMATIONAL", "NAVIGATIONAL", "LOW_SCORED", "ANALYZED")
# инвариант kind <-> status (design §2)
KIND_STATUS = {"transactional": "TRANSACTIONAL", "category": "CATEGORY",
               "informational": "INFORMATIONAL", "navigational": "NAVIGATIONAL"}
SERP_ENGINES = ("yandex", "google")

_client = httpx.Client(timeout=30)
_net_lock = threading.Lock()
_net_calls = 0           # реальных обращений к XMLRiver (тестам нужно «сети не было»)


def load_env(path=ROOT / ".env"):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def net_calls():
    """Сколько раз реально ходили в сеть за пул фразы (кэш такие обращения экономит)."""
    return _net_calls


def reset_net_calls():
    """Сбросить счётчик сетевых обращений (для тестов)."""
    global _net_calls
    with _net_lock:
        _net_calls = 0


def cache_only():
    """Режим «только кэш»: промах кэша НЕ идёт в сеть (XMLRIVER_CACHE_ONLY=1)."""
    load_env()
    return os.environ.get("XMLRIVER_CACHE_ONLY") == "1"


# ---------- схема ----------

_SQL_CACHE = """CREATE TABLE IF NOT EXISTS cache (
    query TEXT PRIMARY KEY, response TEXT NOT NULL, ts INTEGER NOT NULL)"""

# node: базовые колонки (этап 1-2) + поля конвейера (design §3)
_SQL_NODE = """CREATE TABLE IF NOT EXISTS node (
    phrase TEXT PRIMARY KEY,
    freq INTEGER,
    queried INTEGER NOT NULL DEFAULT 0,          -- пул фразы уже запрашивался
    total_refinements INTEGER NOT NULL DEFAULT 0,
    queried_at INTEGER,
    score REAL,                                  -- итог score (Haiku 0-100)
    verdict TEXT,                                -- BUILD|MAYBE|SKIP (analyze)
    note TEXT,                                   -- ручная пометка, пайплайн не трогает
    status TEXT NOT NULL DEFAULT 'NEW',          -- FSM узла (design §2)
    kind TEXT,                                   -- transactional|informational|navigational|category
    classify_conf REAL,
    classify_reason TEXT,
    score_weights TEXT,                          -- JSON весов на момент оценки
    competition_yandex INTEGER,                  -- 0-100, сырой вход score
    competition_google INTEGER,                  -- 0-100, сырой вход score
    description TEXT,                            -- фраза про гэп
    signals_json TEXT,                           -- JSON сигналов score
    verdict_score REAL,                          -- Opus 0-100 «стоит строить»
    error TEXT,
    error_stage TEXT,
    task_id TEXT,                                -- пока не NULL — узел занят операцией
    classified_at INTEGER,
    searched_at INTEGER,
    scored_at INTEGER,
    analyzed_at INTEGER)"""

_SQL_EDGE = """CREATE TABLE IF NOT EXISTS edge (
    parent TEXT NOT NULL, child TEXT NOT NULL, PRIMARY KEY (parent, child))"""

_SQL_SERP = """CREATE TABLE IF NOT EXISTS serp (
    phrase TEXT NOT NULL, engine TEXT NOT NULL,      -- 'yandex' | 'google'
    found INTEGER,                                   -- всего найдено (задел)
    docs_json TEXT NOT NULL,                         -- [{rank,url,title,snippet}]
    fetched_at INTEGER NOT NULL, PRIMARY KEY (phrase, engine))"""

_SQL_TASK = """CREATE TABLE IF NOT EXISTS task (
    id TEXT PRIMARY KEY, type TEXT NOT NULL,         -- load|full_load|classify|search|score|analyze|drill
    status TEXT NOT NULL,                            -- QUEUED|RUNNING|DONE|FAILED
    node TEXT, params TEXT, result TEXT,
    created_at INTEGER, started_at INTEGER, finished_at INTEGER, error TEXT)"""

_SQL_REPORT = """CREATE TABLE IF NOT EXISTS report (
    id TEXT PRIMARY KEY,                             -- = id analyze-задачи
    node TEXT NOT NULL REFERENCES node(phrase),
    link TEXT NOT NULL,                              -- 'reports/{id}.html'
    created_at INTEGER NOT NULL)"""

_SQL_INDEXES = (
    "CREATE INDEX IF NOT EXISTS idx_edge_parent ON edge(parent)",
    "CREATE INDEX IF NOT EXISTS idx_edge_child ON edge(child)",
    "CREATE INDEX IF NOT EXISTS idx_node_status ON node(status)",
    "CREATE INDEX IF NOT EXISTS idx_node_task ON node(task_id)",
    "CREATE INDEX IF NOT EXISTS idx_task_created ON task(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_report_node ON report(node)",
)

# колонки node, которые можно писать через set_status(**fields)
_NODE_WRITABLE = frozenset("""freq queried total_refinements queried_at score verdict note
    status kind classify_conf classify_reason score_weights competition_yandex competition_google
    description signals_json verdict_score error error_stage task_id
    classified_at searched_at scored_at analyzed_at""".split())

# Признак схемы ДО конвейера (этап 1-2): нет колонки status. ТОЛЬКО он даёт право
# пересобрать node/edge из cache. Расширять этот признак НЕЛЬЗЯ: любая новая колонка
# добавляется АДДИТИВНО (_NODE_LATE_COLS + _add_missing_cols), иначе пересоздание сотрёт
# оплаченные результаты пайплайна — правило «после первого прогона только аддитивно» (tech §5).
_PRE_PIPELINE_MARKER = "status"

# Колонки, добавленные ПОСЛЕ первого прогона пайплайна: только через ALTER TABLE.
# Новую колонку дописывать СЮДА, а не в признак схемы выше.
_NODE_LATE_COLS = ()

# статус -> колонка таймстемпа операции (ставится автоматически)
_STATUS_TS = {"TRANSACTIONAL": "classified_at", "CATEGORY": "classified_at",
              "INFORMATIONAL": "classified_at", "NAVIGATIONAL": "classified_at",
              "SEARCHED": "searched_at", "SCORED": "scored_at", "LOW_SCORED": "scored_at",
              "ANALYZED": "analyzed_at"}


def connect(db_path=None, backfill=True):
    """Соединение с полной схемой. Идемпотентно: повторный вызов ничего не ломает.
    Если у node нет колонок конвейера — node/edge пересоздаются по новой схеме и
    модель пересобирается из cache (миграций нет, tech §5). cache/keywords не трогаем."""
    con = sqlite3.connect(db_path or DB_PATH, timeout=30, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute(_SQL_CACHE)  # сырой кэш ответов XMLRiver — только создаём, никогда не сносим
    cols = {r[1] for r in con.execute("PRAGMA table_info(node)")}
    if cols and _PRE_PIPELINE_MARKER not in cols:
        con.execute("DROP TABLE IF EXISTS edge")   # схема этапа 1-2: пересобираем из cache
        con.execute("DROP TABLE IF EXISTS node")
    for sql in (_SQL_NODE, _SQL_EDGE, _SQL_SERP, _SQL_TASK, _SQL_REPORT, *_SQL_INDEXES):
        con.execute(sql)
    _add_missing_cols(con)
    con.commit()
    if backfill:
        _maybe_backfill(con)
    return con


def _add_missing_cols(con):
    """Догнать схему node аддитивно: чего нет — добавить ALTER TABLE, ничего не теряя.
    Так новая колонка не приводит к пересозданию таблицы и потере данных (tech §5)."""
    have = {r[1] for r in con.execute("PRAGMA table_info(node)")}
    for name, decl in _NODE_LATE_COLS:
        if name not in have:
            con.execute(f"ALTER TABLE node ADD COLUMN {name} {decl}")


def db_path_of(con):
    """Путь к файлу БД этого соединения — фетчу в другом треде нужен свой коннект."""
    row = con.execute("PRAGMA database_list").fetchone()
    return row[2] if row and row[2] else DB_PATH


def _cache_con(db_path=None):
    """Короткоживущее соединение для работы с cache из executor-треда (без схемы модели)."""
    con = sqlite3.connect(db_path or DB_PATH, timeout=30)
    con.execute(_SQL_CACHE)
    return con


def normalize(s):
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _chunks(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


# ---------- фетч (сеть/кэш) ----------

# XMLRiver сам просит переспросить (code=500 «Выполните перезапрос»). Это единственный
# случай, когда мы повторяем: отказ помечен источником как транзиентный (design §0).
XMLRIVER_TRANSIENT_CODES = frozenset({500})
RETRY_DELAYS = (10, 30, 60)      # секунды между попытками


class XmlRiverError(RuntimeError):
    """Отказ XMLRiver. Приходит с HTTP 200 и телом {"code":…, "error":…}, поэтому
    raise_for_status его НЕ ловит. Такой ответ нельзя ни кэшировать, ни считать пустым пулом:
    прецедент — 97 записей «code=500 Выполните перезапрос» осели в кэше как «уточнений нет»,
    и 97 узлов навсегда стали листьями."""


def _check_xmlriver(data, query):
    """Ответ XMLRiver — отказ? Тогда исключение, чтобы вызывающий пометил узел незагруженным."""
    if isinstance(data, dict) and (data.get("error") or data.get("code")):
        raise XmlRiverError(f"XMLRiver отказал по {query!r}: "
                            f"code={data.get('code')}, {data.get('error')}")


def _fetch_with_retry(q):
    """Один запрос к Вордстату с повтором на транзиентных отказах: 10 c, 30 c, 60 c.
    Повторяем ТОЛЬКО то, что источник сам просит повторить (code=500) и обрывы связи;
    ошибку в параметрах повторять бессмысленно. Каждая попытка считается платной."""
    global _net_calls
    params = {"user": os.environ["XMLRIVER_USER"], "key": os.environ["XMLRIVER_KEY"], "query": q}
    last = None
    for attempt in range(len(RETRY_DELAYS) + 1):
        if attempt:
            time.sleep(RETRY_DELAYS[attempt - 1])
        with _net_lock:
            _net_calls += 1
        try:
            r = _client.get(BASE_URL, params=params)
            r.raise_for_status()
            data = r.json()
        except (httpx.TransportError, httpx.HTTPStatusError, json.JSONDecodeError) as e:
            last = e                              # обрыв связи/таймаут — тоже транзиентно
            continue
        if not is_transient(data):
            return data                           # результат либо НЕтранзиентная ошибка
        last = XmlRiverError(f"code={data.get('code')}: {data.get('error')}")
    raise XmlRiverError(f"XMLRiver не ответил по {q!r} за {len(RETRY_DELAYS) + 1} попыток: {last}")


def is_error_response(data):
    """Отравленная запись кэша (сохранённый отказ), а не результат."""
    return isinstance(data, dict) and bool(data.get("error") or data.get("code"))


def is_transient(data):
    """Отказ, который источник просит повторить (а не наша ошибка в параметрах)."""
    return (isinstance(data, dict)
            and data.get("code") in XMLRIVER_TRANSIENT_CODES)


def fetch_wordstat(query, con=None):
    """Ответ XMLRiver по фразе. Кэш в semcore.db: повторный запрос бесплатен.
    В режиме cache_only() промах кэша НЕ идёт в сеть — отдаём пустой ответ, чтобы
    краул считал узел листом (и ни одного платного запроса)."""
    global _net_calls
    q = normalize(query)
    own = con is None
    if own:
        con = _cache_con()
    try:
        row = con.execute("SELECT response FROM cache WHERE query = ?", (q,)).fetchone()
        if row:
            cached = json.loads(row[0])
            if not is_error_response(cached):
                return cached
            con.execute("DELETE FROM cache WHERE query = ?", (q,))   # старая отрава: выбросить
            con.commit()
        if cache_only():
            return {"popular": []}
        load_env()
        data = _fetch_with_retry(q)
        _check_xmlriver(data, q)   # отказ XMLRiver приходит с HTTP 200 — в кэш его НЕЛЬЗЯ
        con.execute("INSERT OR REPLACE INTO cache (query, response, ts) VALUES (?, ?, strftime('%s','now'))",
                    (q, json.dumps(data, ensure_ascii=False)))
        con.commit()
        return data
    finally:
        if own:
            con.close()


def parse_popular(data):
    """popular (фразы, содержащие запрос) -> [(phrase, freq)]."""
    out = []
    for it in data.get("popular", []) or []:
        p = normalize(it.get("text", ""))
        if not p:
            continue
        try:
            f = int(it.get("value", 0))
        except (ValueError, TypeError):
            f = 0
        out.append((p, f))
    return out


# ---------- утилиты дерева (для локальной группировки в скриптах) ----------

_ENDINGS = sorted(
    ["ого", "его", "ому", "ему", "ыми", "ими", "ами", "ями", "ью", "ей", "ов", "ев",
     "ий", "ый", "ой", "ая", "яя", "ое", "ее", "ые", "ие", "ую", "юю", "их", "ых",
     "ам", "ям", "ом", "ем", "ах", "ях", "у", "ю", "е", "о", "а", "я", "и", "ы", "ь", "й"],
    key=len, reverse=True)


def stem(w):
    for e in _ENDINGS:
        if w.endswith(e) and len(w) - len(e) >= 3:
            return w[:-len(e)]
    return w


def words_of(p):
    return frozenset(stem(t) for t in normalize(p).split())


def build_forest(items):
    """items: [(phrase, freq)] -> корни с детьми по вложенности слов."""
    nodes = {p: {"phrase": p, "freq": f, "words": words_of(p), "children": []}
             for p, f in items}
    roots = []
    for n in sorted(nodes.values(), key=lambda x: (len(x["words"]), -x["freq"])):
        best = None
        for m in nodes.values():
            if m is n or not (m["words"] < n["words"]):
                continue
            if best is None or (len(m["words"]), m["freq"]) > (len(best["words"]), best["freq"]):
                best = m
        (roots if best is None else best["children"]).append(n)
    return roots


# ---------- уточнения (дети узла) + проверка кэша ----------

def refinements(qn, data):
    """Из ответа по фразе qn — дочерние уточнения: popular-фразы, которые являются
    словесным супермножеством qn (т.е. содержат его и что-то ещё)."""
    qw = words_of(qn)
    return [(p, f) for p, f in parse_popular(data) if words_of(p) > qw]


def cached_child_count(phrase, con):
    """Сколько уточнений у фразы, ЕСЛИ она уже в кэше. None — если не кэширована."""
    qn = normalize(phrase)
    row = con.execute("SELECT response FROM cache WHERE query = ?", (qn,)).fetchone()
    if not row:
        return None
    return len(refinements(qn, json.loads(row[0])))


# ---------- модель (nodes + edges) ----------

def upsert_node(con, phrase, freq=None, queried=False, total=None):
    p = normalize(phrase)
    row = con.execute("SELECT freq, queried, total_refinements FROM node WHERE phrase = ?", (p,)).fetchone()
    if row is None:
        con.execute(
            "INSERT INTO node(phrase, freq, queried, total_refinements, queried_at) "
            "VALUES (?, ?, ?, ?, strftime('%s','now'))",
            (p, freq or 0, 1 if queried else 0, total or 0))
    else:
        cur_freq, cur_q, cur_total = row[0], row[1], row[2]
        con.execute(
            "UPDATE node SET freq = ?, queried = ?, total_refinements = ?, "
            "queried_at = CASE WHEN ? = 1 THEN strftime('%s','now') ELSE queried_at END "
            "WHERE phrase = ?",
            (freq if freq is not None else cur_freq,
             1 if (queried or cur_q) else 0,
             total if total is not None else cur_total,
             1 if queried else 0, p))


def _parse_pool(qn, data, limit):
    """Ответ XMLRiver -> (own_freq, refs) — своя частота и дети по убыванию частоты."""
    own_freq = next((f for p, f in parse_popular(data) if p == qn), None)
    refs = refinements(qn, data)
    refs.sort(key=lambda x: x[1], reverse=True)
    return own_freq, refs[:limit]


def fetch_phrase(phrase, limit=LIMIT, db_path=None):
    """ТОЛЬКО сеть/кэш + разбор, без записи в модель — можно гонять в executor-треде.
    Открывает собственное соединение к cache. -> (phrase, own_freq, refs)."""
    qn = normalize(phrase)
    con = _cache_con(db_path)
    try:
        data = fetch_wordstat(qn, con)
    finally:
        con.close()
    own_freq, refs = _parse_pool(qn, data, limit)
    return qn, own_freq, refs


def save_phrase(con, phrase, own_freq, refs):
    """Запись результата фетча в модель (только loop-тред): узел queried=1 + рёбра к
    уточнениям. Статус не трогает — переходы FSM идут через set_status().
    -> (own_freq, total)."""
    qn = normalize(phrase)
    upsert_node(con, qn, freq=own_freq, queried=True, total=len(refs))
    for p, f in refs:
        upsert_node(con, p, freq=f)
        con.execute("INSERT OR IGNORE INTO edge(parent, child) VALUES (?, ?)", (qn, p))
    con.commit()
    return own_freq, len(refs)


def load_phrase(con, phrase, limit=LIMIT):
    """Запросить пул фразы (кэш) и записать в модель: узел queried=1 + рёбра к
    уточнениям (весь пул, до limit). Возвращает (own_freq, total)."""
    qn = normalize(phrase)
    own_freq, refs = _parse_pool(qn, fetch_wordstat(qn, con), limit)
    return save_phrase(con, qn, own_freq, refs)


def _child_phrases(con, parent):
    return [r[0] for r in con.execute("SELECT child FROM edge WHERE parent = ?", (parent,))]


def subtree_phrases(con, phrase):
    """Все фразы поддерева, включая корень. Дерево — DAG, поэтому обход с visited."""
    root = normalize(phrase)
    seen = {root}
    out = [root]
    queue = deque([root])
    while queue:
        for ch in _child_phrases(con, queue.popleft()):
            if ch not in seen:
                seen.add(ch)
                out.append(ch)
                queue.append(ch)
    return out


def estimate_subtree(con, phrase, floor=FLOOR):
    """Нижняя оценка объёма full_load по уже известному поддереву:
    {nodes: узлов, requests: сколько фетчей осталось}. Может вырасти по ходу краула."""
    phrases = subtree_phrases(con, phrase)
    requests = 0
    for chunk in _chunks(phrases, 400):
        qs = ",".join("?" * len(chunk))
        requests += con.execute(
            f"SELECT COUNT(*) FROM node WHERE phrase IN ({qs}) "
            "AND queried = 0 AND COALESCE(freq, 0) >= ?", (*chunk, floor)).fetchone()[0]
    root = con.execute("SELECT queried, COALESCE(freq, 0) FROM node WHERE phrase = ?",
                       (normalize(phrase),)).fetchone()
    if (root is None or not root[0]) and requests == 0:
        requests = 1  # сам корень фетчится всегда, какая бы у него ни была частота
    return {"nodes": len(phrases), "requests": requests}


# ---------- краул поддерева (full_load) ----------

async def crawl_subtree(con, phrase, on_progress=None, workers=WORKERS, limit=LIMIT, floor=FLOOR):
    """Краул поддерева до опустевшего фронтира (design §4).

    Фронтир — загруженные, но ещё не queried узлы поддерева с freq >= floor; корень
    фетчится всегда. Ниже floor вглубь не идём, но сам узел и ребро уже записаны.
    Фраза с несколькими родителями фетчится один раз (visited-множество).
    Фетчи — в executor, не более workers одновременно; в БД пишем только тут, на
    loop-треде. on_progress(done, total, phrase) — колбэк прогресса (можно async);
    total — текущая оценка числа фетчей, она растёт по ходу.
    По завершении всё поддерево (включая листы ниже floor) получает FULLY_LOADED.
    Повторный запуск не дублирует данные и не фетчит заново.
    -> {"fetched", "nodes", "errors": [(phrase, текст)]}."""
    loop = asyncio.get_running_loop()
    db = db_path_of(con)
    root = normalize(phrase)
    sem = asyncio.Semaphore(max(1, workers))
    upsert_node(con, root)
    con.commit()

    async def fetch(p):
        async with sem:
            return await loop.run_in_executor(None, fetch_phrase, p, limit, db)

    async def progress(done, total, p):
        if on_progress is None:
            return
        r = on_progress(done, total, p)
        if inspect.isawaitable(r):
            await r

    seen = {root}          # уже осмотренные фразы — дедуп по DAG
    queue = deque([root])
    running = {}           # task -> phrase
    done = total = 0
    errors = []

    while queue or running:
        while queue:
            p = queue.popleft()
            row = con.execute("SELECT queried, COALESCE(freq, 0) FROM node WHERE phrase = ?",
                              (p,)).fetchone()
            if row and row[0]:
                for ch in _child_phrases(con, p):  # загружен ранее — идём по его детям
                    if ch not in seen:
                        seen.add(ch)
                        queue.append(ch)
                continue
            if p != root and (row[1] if row else 0) < floor:
                continue                          # лист: ниже FLOOR вглубь не бурим
            total += 1
            running[asyncio.ensure_future(fetch(p))] = p
        if not running:
            break
        finished, _ = await asyncio.wait(set(running), return_when=asyncio.FIRST_COMPLETED)
        for t in finished:
            p = running.pop(t)
            done += 1
            try:
                qn, own_freq, refs = t.result()
            except Exception as e:  # фетч упал: узел остаётся как был, идём дальше
                errors.append((p, f"{type(e).__name__}: {e}"))
                await progress(done, total, p)
                continue
            save_phrase(con, qn, own_freq, refs)
            for ch, _f in refs:
                if ch not in seen:
                    seen.add(ch)
                    queue.append(ch)
            await progress(done, total, qn)

    phrases = subtree_phrases(con, root)
    failed = {p for p, _ in errors}
    ok = [(p,) for p in phrases if p not in failed]
    # FULLY_LOADED = «загружено настолько, насколько разрешает FLOOR» (tech §5), включая
    # листы ниже FLOOR. Узлы, ушедшие дальше по пайплайну, не откатываем (идемпотентность);
    # узлы с упавшим фетчем остаются как были — им пишем только ошибку.
    con.executemany("UPDATE node SET status = 'FULLY_LOADED' "
                    "WHERE phrase = ? AND status IN ('NEW', 'LOADED')", ok)
    con.executemany("UPDATE node SET error = NULL, error_stage = NULL "
                    "WHERE phrase = ? AND error_stage = 'full_load'", ok)
    con.executemany("UPDATE node SET error = ?, error_stage = 'full_load' WHERE phrase = ?",
                    [(msg, p) for p, msg in errors])
    con.commit()
    return {"fetched": done, "nodes": len(phrases), "errors": errors}


# ---------- данные для classify ----------

def subtree_for_classify(con, phrase, chunk=None, floor=FLOOR):
    """Данные для classify (design §6.1): плоский дедуплицированный список узлов
    поддерева [{phrase, freq, children:[фраза,…]}], дети ниже floor отфильтрованы,
    нарезанный на чанки по chunk узлов. -> [[узел,…], …]."""
    chunk = chunk or CLASSIFY_CHUNK
    root = normalize(phrase)
    seen = {root}
    queue = deque([root])
    nodes = []
    while queue:
        p = queue.popleft()
        row = con.execute("SELECT COALESCE(freq, 0) FROM node WHERE phrase = ?", (p,)).fetchone()
        kids = con.execute(
            "SELECT n.phrase, COALESCE(n.freq, 0) FROM edge e JOIN node n ON n.phrase = e.child "
            "WHERE e.parent = ? ORDER BY 2 DESC", (p,)).fetchall()
        nodes.append({"phrase": p, "freq": row[0] if row else 0,
                      "children": [k[0] for k in kids if k[1] >= floor]})
        for k in kids:
            if k[0] not in seen:
                seen.add(k[0])
                queue.append(k[0])
    return [nodes[i:i + chunk] for i in range(0, len(nodes), chunk)]


# ---------- объект узла и запись статуса ----------

_NODE_OBJ_COLS = """n.phrase, COALESCE(n.freq, 0) AS freq, n.status, n.kind, n.score, n.verdict,
    n.verdict_score, n.task_id, n.error, n.queried, n.total_refinements,
    (SELECT link FROM report WHERE node = n.phrase ORDER BY created_at DESC LIMIT 1) AS report_link"""


def _node_obj(row):
    """Строка node -> объект узла для WS (tech §6.2)."""
    obj = {
        "phrase": row["phrase"], "freq": row["freq"], "status": row["status"],
        "kind": row["kind"], "score": row["score"], "verdict": row["verdict"],
        "verdict_score": row["verdict_score"], "task_id": row["task_id"],
        "error": row["error"], "cached": bool(row["queried"]),
        "childCount": row["total_refinements"] or 0,
    }
    if row["report_link"]:
        obj["report_link"] = row["report_link"]  # только при наличии отчёта
    return obj


def get_node(con, phrase):
    """Сырая строка node (или None) — для проверок FSM/404 на стороне сервера."""
    return con.execute("SELECT * FROM node WHERE phrase = ?", (normalize(phrase),)).fetchone()


def node_object(con, phrase):
    """Объект узла (tech §6.2) или None, если узла нет."""
    row = con.execute(f"SELECT {_NODE_OBJ_COLS} FROM node n WHERE n.phrase = ?",
                      (normalize(phrase),)).fetchone()
    return _node_obj(row) if row else None


def set_status(con, phrase, status=None, **fields):
    """Единая точка записи статуса: пишет status (если задан) и любые переданные
    колонки node, возвращает дельту узла (объект узла, tech §6.2) для события WS.
    Смена статуса сама ставит таймстемп операции и чистит error/error_stage, если их
    не передали явно (ошибку пишут вызовом со status=None). KeyError, если узла нет."""
    p = normalize(phrase)
    if status is not None and status not in STATUSES:
        raise ValueError(f"неизвестный статус: {status}")
    unknown = set(fields) - _NODE_WRITABLE
    if unknown:
        raise ValueError(f"неизвестные колонки node: {sorted(unknown)}")
    if con.execute("SELECT 1 FROM node WHERE phrase = ?", (p,)).fetchone() is None:
        raise KeyError(p)
    if status is not None:
        fields["status"] = status
        fields.setdefault("error", None)
        fields.setdefault("error_stage", None)
        ts = _STATUS_TS.get(status)
        if ts:
            fields.setdefault(ts, int(time.time()))
    if fields:
        sets = ", ".join(f"{k} = ?" for k in fields)
        con.execute(f"UPDATE node SET {sets} WHERE phrase = ?", (*fields.values(), p))
        con.commit()
    return node_object(con, p)


def override_kind(con, phrase, kind):
    """Ручной оверрайд Fix kind: kind и status меняются вместе (инвариант kind<->status,
    design §2). Для transactional статус откатывается к TRANSACTIONAL; собранные ранее
    выдача/скор/отчёт не удаляются. -> дельта узла."""
    k = normalize(kind)
    if k not in KIND_STATUS:
        raise ValueError(f"неизвестный kind: {kind}")
    return set_status(con, phrase, KIND_STATUS[k], kind=k)


def clear_stale_locks(con):
    """Старт сервера: незавершённые задачи -> FAILED, блокировки узлов снимаются
    (tech §2). -> сколько узлов разблокировано."""
    con.execute("UPDATE task SET status = 'FAILED', finished_at = ?, "
                "error = COALESCE(error, 'прервано перезапуском сервера') "
                "WHERE status IN ('QUEUED', 'RUNNING')", (int(time.time()),))
    cur = con.execute("UPDATE node SET task_id = NULL WHERE task_id IS NOT NULL")
    con.commit()
    return cur.rowcount


def repair_fully_loaded(con):
    """Инвариант: узел НЕ может быть FULLY_LOADED, если в его поддереве есть незагруженный
    узел с freq >= FLOOR. Нарушители сбрасываются в LOADED. -> сколько исправлено.

    Зачем: статус FULLY_LOADED ставит краул на всё поддерево, но узлы могут стать
    незагруженными ПОЗЖЕ — например при выбрасывании отравленной записи кэша. Тогда предки
    продолжают утверждать «загружено полностью», хотя это уже ложь, и full_load по ним
    даже не запустить (операция разрешена только из NEW/LOADED).
    Прецедент: чистка 97 сохранённых отказов XMLRiver оставила 72 таких предка."""
    cur = con.execute(f"""
        UPDATE node SET status = 'LOADED'
        WHERE status = 'FULLY_LOADED' AND EXISTS (
          WITH RECURSIVE sub(p) AS (
            SELECT node.phrase UNION SELECT e.child FROM edge e JOIN sub ON e.parent = sub.p)
          SELECT 1 FROM node n JOIN sub ON n.phrase = sub.p
          WHERE n.queried = 0 AND COALESCE(n.freq, 0) >= {FLOOR})""")
    con.commit()
    return cur.rowcount


# ---------- выдача (serp) ----------

def save_serp(con, phrase, serps):
    """Записать выдачу узла: serps = {engine: {"found": int|None, "docs": [{rank,url,title,
    snippet}]}} (или просто {engine: [docs]}). Инвариант no-partial: нет какой-то из
    выдач -> ValueError и в БД не попадает ничего. Одна транзакция, без await внутри."""
    p = normalize(phrase)
    now = int(time.time())
    rows = []
    for engine in SERP_ENGINES:
        part = serps.get(engine)
        if part is None:
            raise ValueError(f"нет выдачи движка {engine} — частичная запись запрещена")
        docs = part if isinstance(part, list) else part.get("docs")
        if not isinstance(docs, list):
            raise ValueError(f"выдача движка {engine} без списка docs")
        found = None if isinstance(part, list) else part.get("found")
        rows.append((p, engine, found, json.dumps(docs, ensure_ascii=False), now))
    try:
        con.executemany("INSERT OR REPLACE INTO serp(phrase, engine, found, docs_json, fetched_at) "
                        "VALUES (?, ?, ?, ?, ?)", rows)
        con.commit()
    except Exception:
        con.rollback()
        raise
    return len(rows)


def load_serp(con, phrase):
    """Сохранённая выдача узла: {engine: {found, docs, fetched_at}}; ничего нет -> {}."""
    out = {}
    for r in con.execute("SELECT engine, found, docs_json, fetched_at FROM serp WHERE phrase = ?",
                         (normalize(phrase),)):
        out[r[0]] = {"found": r[1], "docs": json.loads(r[2]), "fetched_at": r[3]}
    return out


# ---------- отчёты ----------

def save_report(con, report_id, node, link, created_at=None):
    """Строка отчёта (сам HTML лежит файлом на диске). -> данные события report."""
    con.execute("INSERT OR REPLACE INTO report(id, node, link, created_at) VALUES (?, ?, ?, ?)",
                (report_id, normalize(node), link, created_at or int(time.time())))
    con.commit()
    return report_row(con, report_id)


def report_row(con, report_id):
    """Отчёт + поля узла (report JOIN node) в форме события report (tech §6.2)."""
    r = con.execute(
        "SELECT r.id, r.node, r.link, r.created_at, n.verdict, n.verdict_score "
        "FROM report r LEFT JOIN node n ON n.phrase = r.node WHERE r.id = ?", (report_id,)).fetchone()
    if not r:
        return None
    return {"id": r[0], "node": r[1], "title": r[1], "verdict": r[4],
            "verdict_score": r[5], "link": r[2], "created_at": r[3]}


def list_reports(con, limit=500):
    """Вкладка «Отчёты»: report JOIN node, по убыванию verdict_score."""
    rows = con.execute(
        "SELECT r.id, r.node, r.link, r.created_at, n.verdict, n.verdict_score "
        "FROM report r LEFT JOIN node n ON n.phrase = r.node "
        "ORDER BY COALESCE(n.verdict_score, -1) DESC, r.created_at DESC LIMIT ?", (limit,)).fetchall()
    return [{"id": r[0], "node": r[1], "title": r[1], "verdict": r[4],
             "verdict_score": r[5], "link": r[2], "created_at": r[3]} for r in rows]


# ---------- корни и проекция детей ----------

def root_candidates(con, limit=50):
    """Корни-кандидаты (tech §6.2): узлы, ни разу не встречавшиеся как чей-то ребёнок,
    по убыванию частоты. -> [объект узла] без children."""
    rows = con.execute(
        f"SELECT {_NODE_OBJ_COLS} FROM node n "
        "WHERE NOT EXISTS (SELECT 1 FROM edge WHERE child = n.phrase) "
        "ORDER BY COALESCE(n.freq, 0) DESC LIMIT ?", (limit,)).fetchall()
    return [_node_obj(r) for r in rows]


def project(con, phrase):
    """Проекция сохранённого пула фразы для фронта: локальная вложенность по словам,
    каждый узел — объект узла (tech §6.2) плюс children."""
    qn = normalize(phrase)
    rows = con.execute(
        f"SELECT {_NODE_OBJ_COLS} FROM node n JOIN edge e ON e.child = n.phrase "
        "WHERE e.parent = ?", (qn,)).fetchall()
    meta = {r["phrase"]: _node_obj(r) for r in rows}
    refs = [(r["phrase"], r["freq"]) for r in rows]

    def ser(nodes):
        out = []
        for nd in sorted(nodes, key=lambda x: -x["freq"]):
            obj = dict(meta.get(nd["phrase"]) or {
                "phrase": nd["phrase"], "freq": nd["freq"], "status": "NEW", "kind": None,
                "score": None, "verdict": None, "verdict_score": None, "task_id": None,
                "error": None, "cached": False, "childCount": 0})
            obj["children"] = ser(nd["children"])
            out.append(obj)
        return out

    return ser(build_forest(refs))


# ---------- пересбор модели из кэша ----------

def rebuild_model_from_cache(con, limit=LIMIT):
    """Пересбор модели (node/edge) из уже накопленного кэша ответов. Идемпотентен."""
    for row in con.execute("SELECT query, response FROM cache").fetchall():
        q, resp = row[0], row[1]
        try:
            data = json.loads(resp)
        except (ValueError, TypeError):
            continue
        qn = normalize(q)
        own_freq, refs = _parse_pool(qn, data, limit)
        upsert_node(con, qn, freq=own_freq, queried=True, total=len(refs))
        for p, f in refs:
            upsert_node(con, p, freq=f)
            con.execute("INSERT OR IGNORE INTO edge(parent, child) VALUES (?, ?)", (qn, p))
    con.commit()


def _maybe_backfill(con):
    if con.execute("SELECT COUNT(*) FROM node").fetchone()[0] == 0:
        if con.execute("SELECT COUNT(*) FROM cache").fetchone()[0] > 0:
            rebuild_model_from_cache(con)
