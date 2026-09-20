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
import datetime
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
RECHECK_ROUNDS = 5       # кругов перепроверки фронтира за один краул (страховка от петли)
SCORE_THRESHOLD = 60     # score > порога -> SCORED, <= -> LOW_SCORED (design §6.3)
LIMIT = 2000             # весь пул фразы: потолок самого XMLRiver
WORKERS = 6              # одновременных фетчей во время краула
CLASSIFY_CHUNK = 120     # узлов в одном classify-джобе (tech §3)

# Домен — ручная группа входных веток одного SEO-проекта. Это не ребро
# дерева: каждый член сохраняет своё поддерево, статус и команды загрузки.
DESTINY_MATRIX_DOMAIN_ID = "destiny-matrix"
DESTINY_MATRIX_DOMAIN_NAME = "Матрица судьбы"
DESTINY_MATRIX_DOMAIN_KEYS = (
    "матрица судьбы",
    "нумерология рождения",
    "нумерология по дате",
    "нумерология по дате рождения",
    "судьба по дате рождения",
    "число по дате рождения",
    "аркан по дате рождения",
    "пифагора по дате рождения",
    "психоматрица по дате рождения",
    "совместимость по дате рождения",
    "совместимость по нумерологии",
    "прогноз по дате рождения",
    "нумерология на год",
    "нумерология дня",
    "что меня ждет по дате рождения",
    "удачные даты по дате рождения",
    "какая дата подходит по дате рождения",
)

STATUSES = ("NEW", "LOADED", "FULLY_LOADED", "TRANSACTIONAL", "CATEGORY", "INFORMATIONAL",
            "NAVIGATIONAL", "SEARCHED", "SCORED", "LOW_SCORED", "ANALYZED")
TERMINALS = ("CATEGORY", "INFORMATIONAL", "NAVIGATIONAL", "LOW_SCORED", "ANALYZED")
# инвариант kind <-> status (design §2)
KIND_STATUS = {"transactional": "TRANSACTIONAL", "category": "CATEGORY",
               "informational": "INFORMATIONAL", "navigational": "NAVIGATIONAL"}
SERP_ENGINES = ("yandex", "google")
# Подсказки поисковой строки. URL отдельный от выдачи и от пула: у провайдера это свой режим
# (`setab=tips`), POST со списком фраз, и платится КАЖДАЯ фраза пакета, а не запрос.
SUGGEST_URL = "http://xmlriver.com/search/xml"
SUGGEST_BATCH = 50          # потолок провайдера на одну отправку
SUGGEST_SOURCES = ("google", "yandex")
SUGGEST_REGIONS = {"us": "2840", "uk": "2826", "ru": "225"}

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

# Запросы, купленные не для дерева, а для замера рядом с ним (смежные ключи второго слоя).
# Кэш общий и оплаченный, дерево — нет: без этой пометки пересборка модели из кэша втянула бы
# чужие пулы в факты и дерево выросло бы на тысячи узлов, которых никто не краулил.
_SQL_PROBE = """CREATE TABLE IF NOT EXISTS probe (
    query TEXT PRIMARY KEY, kind TEXT, created_at INTEGER NOT NULL)"""

# Стоп-слова: что мы сознательно НЕ покупаем. Хранится слово, сравнение идёт по основе —
# «проститутка» и «проститутки» это одно слово, а падежей у Вордстата полный набор.
# Область действия — общая, узел или домен: «учебник» бессмыслен в ветке «pdf» и осмыслен
# в ветке про школу, поэтому владелец списка входит в ключ.
_SQL_STOPWORD = """CREATE TABLE IF NOT EXISTS stopword (
    word TEXT NOT NULL,
    kind TEXT NOT NULL,
    scope_kind TEXT NOT NULL DEFAULT 'global',    -- global | node | domain
    scope_id TEXT NOT NULL DEFAULT '',            -- '' | фраза узла | id домена
    added_at INTEGER NOT NULL,
    PRIMARY KEY (word, scope_kind, scope_id))"""

# node: базовые колонки (этап 1-2) + поля конвейера (design §3)
_SQL_HISTORY = """CREATE TABLE IF NOT EXISTS history (
    phrase TEXT PRIMARY KEY,
    series_json TEXT NOT NULL,                   -- [{"ym":"2025-09","y":1247}, ...] по месяцам
    fetched_at INTEGER NOT NULL)"""

_SQL_NODE = """CREATE TABLE IF NOT EXISTS node (
    phrase TEXT PRIMARY KEY,
    freq INTEGER,
    queried INTEGER NOT NULL DEFAULT 0,          -- пул фразы уже запрашивался
    total_refinements INTEGER NOT NULL DEFAULT 0,
    queried_at INTEGER,
    freq_at INTEGER,                             -- когда снят пул, из которого взята freq
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

_SQL_DOMAIN = """CREATE TABLE IF NOT EXISTS domain (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL)"""

_SQL_DOMAIN_MEMBER = """CREATE TABLE IF NOT EXISTS domain_member (
    domain_id TEXT NOT NULL,
    phrase TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (domain_id, phrase),
    UNIQUE (domain_id, position),
    FOREIGN KEY (domain_id) REFERENCES domain(id),
    FOREIGN KEY (phrase) REFERENCES node(phrase))"""

_SQL_SERP = """CREATE TABLE IF NOT EXISTS serp (
    phrase TEXT NOT NULL, engine TEXT NOT NULL,      -- 'yandex' | 'google'
    found INTEGER,                                   -- всего найдено (задел)
    docs_json TEXT NOT NULL,                         -- [{rank,url,title,snippet}]
    fetched_at INTEGER NOT NULL, PRIMARY KEY (phrase, engine))"""

# Подсказки поисковой строки: что люди набирают по этому корню. Отдельная таблица, а не
# `cache`: там ключ — голая фраза, и чужой ответ затёр бы оплаченный пул Вордстата, а
# `rebuild_model_from_cache` разобрал бы его как пул и завёл из него узлы дерева.
# Регион в ключе обязателен — подсказки зависят от гео; порядок подсказок хранится как есть:
# он и есть сигнал популярности.
_SQL_SUGGEST = """CREATE TABLE IF NOT EXISTS suggest (
    phrase TEXT NOT NULL, source TEXT NOT NULL,      -- 'google' | 'yandex'
    region TEXT NOT NULL,                            -- geo target источника: '2840', 'ru'
    items_json TEXT NOT NULL,                        -- ["destiny matrix calculator", ...]
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (phrase, source, region))"""

_SQL_TASK = """CREATE TABLE IF NOT EXISTS task (
    id TEXT PRIMARY KEY, type TEXT NOT NULL,         -- load|full_load|classify|search|score|analyze|drill
    status TEXT NOT NULL,                            -- QUEUED|RUNNING|DONE|FAILED
    node TEXT, params TEXT, result TEXT,
    model_family TEXT,                               -- claude|codex для модельных разборов
    created_at INTEGER, started_at INTEGER, finished_at INTEGER, error TEXT)"""

_SQL_REPORT = """CREATE TABLE IF NOT EXISTS report (
    id TEXT PRIMARY KEY,                             -- = id analyze-задачи
    node TEXT NOT NULL REFERENCES node(phrase),
    link TEXT NOT NULL,                              -- 'reports/{id}.html'
    created_at INTEGER NOT NULL)"""

_SQL_INDEXES = (
    "CREATE INDEX IF NOT EXISTS idx_edge_parent ON edge(parent)",
    "CREATE INDEX IF NOT EXISTS idx_edge_child ON edge(child)",
    "CREATE INDEX IF NOT EXISTS idx_domain_member_phrase ON domain_member(phrase)",
    "CREATE INDEX IF NOT EXISTS idx_stopword_scope ON stopword(scope_kind, scope_id)",
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
_NODE_LATE_COLS = (("freq_at", "INTEGER"),)
_TASK_LATE_COLS = (("model_family", "TEXT"),)

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
    fresh_probe = not list(con.execute("PRAGMA table_info(probe)"))
    cols = {r[1] for r in con.execute("PRAGMA table_info(node)")}
    if cols and _PRE_PIPELINE_MARKER not in cols:
        con.execute("DROP TABLE IF EXISTS edge")   # схема этапа 1-2: пересобираем из cache
        con.execute("DROP TABLE IF EXISTS node")
    _migrate_stopword_scope(con)
    for sql in (_SQL_NODE, _SQL_EDGE, _SQL_DOMAIN, _SQL_DOMAIN_MEMBER, _SQL_SERP, _SQL_TASK,
                _SQL_REPORT, _SQL_HISTORY, _SQL_PROBE, _SQL_STOPWORD, _SQL_SUGGEST,
                *_SQL_INDEXES):
        con.execute(sql)
    _add_missing_cols(con)
    con.commit()
    if fresh_probe:
        _mark_orphan_probes(con)
    if backfill:
        _maybe_backfill(con)
    ensure_default_domains(con)
    return con


def mark_probe(con, phrases, kind):
    """Запомнить, что эти запросы куплены для замера, а не для дерева."""
    now = int(time.time())
    con.executemany("INSERT OR IGNORE INTO probe(query, kind, created_at) VALUES (?, ?, ?)",
                    [(normalize(p), kind, now) for p in phrases])
    con.commit()


def _mark_orphan_probes(con):
    """Разовая разметка замеров, сделанных до появления таблицы `probe`.

    Признак — запрос есть в кэше, а его фразы нет в дереве: краул всегда пишет узел сразу
    после фетча, поэтому осиротеть может только покупка второго слоя. Делаем один раз при
    создании таблицы и только при непустом дереве: на пустом node признак разметил бы весь
    кэш, а на живой базе тот же признак ловил бы окно между фетчем и записью узла."""
    if con.execute("SELECT COUNT(*) FROM node").fetchone()[0] == 0:
        return
    rows = con.execute("SELECT query FROM cache WHERE NOT EXISTS ("
                       "SELECT 1 FROM node WHERE node.phrase = cache.query)").fetchall()
    if rows:
        mark_probe(con, [r[0] for r in rows], "adjacent")


def _migrate_stopword_scope(con):
    """Дать старому списку исключений владельца: всё накопленное становится общим.

    Ключ таблицы менялся (`word` -> `word + владелец`), а PRIMARY KEY в sqlite правится
    только пересозданием. Слова вводил человек, поэтому переливаем, а не пересоздаём.
    """
    cols = {r[1] for r in con.execute("PRAGMA table_info(stopword)")}
    if not cols or "scope_kind" in cols:
        return False
    con.execute("ALTER TABLE stopword RENAME TO stopword_pre_scope")
    con.execute(_SQL_STOPWORD)
    con.execute("INSERT OR IGNORE INTO stopword(word, kind, scope_kind, scope_id, added_at) "
                "SELECT word, kind, 'global', '', added_at FROM stopword_pre_scope")
    con.execute("DROP TABLE stopword_pre_scope")
    con.commit()
    return True


def _add_missing_cols(con):
    """Догнать схемы аддитивно: новые колонки не должны стирать оплаченные данные."""
    for table, columns in (("node", _NODE_LATE_COLS), ("task", _TASK_LATE_COLS)):
        have = {r[1] for r in con.execute(f"PRAGMA table_info({table})")}
        for name, decl in columns:
            if name not in have:
                con.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")
    # До появления семейств все три этапа анализа запускались Claude. Basic-задачи и
    # операции первого слоя семейства не имеют и остаются NULL.
    con.execute("UPDATE task SET model_family = 'claude' "
                "WHERE model_family IS NULL AND type IN "
                "('needs_analyze', 'needs_analyze_adv', 'needs_analyze_product')")


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


def _fetch_with_retry(q, extra=None):
    """Один запрос к Вордстату с повтором на транзиентных отказах: 10 c, 30 c, 60 c.
    Повторяем ТОЛЬКО то, что источник сам просит повторить (code=500) и обрывы связи;
    ошибку в параметрах повторять бессмысленно. Каждая попытка считается платной."""
    global _net_calls
    params = {"user": os.environ["XMLRIVER_USER"], "key": os.environ["XMLRIVER_KEY"], "query": q,
              **(extra or {})}
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
    """Отказ, который источник просит повторить (а не наша ошибка в параметрах).

    Код приводится к числу: в режиме подсказок тот же провайдер присылает `"code": "500"`
    строкой, и сравнение с числом молча считало транзиентный отказ фатальным."""
    if not isinstance(data, dict):
        return False
    code = data.get("code")
    if isinstance(code, str) and code.strip().isdigit():
        code = int(code)
    return code in XMLRIVER_TRANSIENT_CODES


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


# ---------- модель (nodes + edges) ----------

def upsert_node(con, phrase, freq=None, queried=False, total=None, freq_at=None):
    """Записать узел. `freq_at` — когда снят пул, откуда взята частота.

    Частоту переписывает только НЕ БОЛЕЕ СТАРЫЙ пул. Раньше побеждал тот, что обработали
    последним, а порядок обхода к возрасту данных отношения не имеет: пул от 21.07 затирал
    свежий от 26.07. Частота — измерение во времени (у Вордстата она ползёт: одна и та же
    фраза за пять дней ушла с 49 на 59), поэтому «свежее» и есть «вернее».
    `freq_at=None` — возраст неизвестен, считаем значение свежим (обычно это живой фетч)."""
    p = normalize(phrase)
    row = con.execute("SELECT freq, queried, total_refinements, freq_at FROM node "
                      "WHERE phrase = ?", (p,)).fetchone()
    if row is None:
        con.execute(
            "INSERT INTO node(phrase, freq, queried, total_refinements, queried_at, freq_at) "
            "VALUES (?, ?, ?, ?, strftime('%s','now'), ?)",
            (p, freq or 0, 1 if queried else 0, total or 0, freq_at))
        return
    cur_freq, cur_q, cur_total, cur_at = row[0], row[1], row[2], row[3]
    stale = (freq is not None and freq_at is not None and cur_at is not None
             and freq_at < cur_at)
    con.execute(
        "UPDATE node SET freq = ?, freq_at = ?, queried = ?, total_refinements = ?, "
        "queried_at = CASE WHEN ? = 1 THEN strftime('%s','now') ELSE queried_at END "
        "WHERE phrase = ?",
        (cur_freq if (freq is None or stale) else freq,
         cur_at if (freq is None or stale) else (freq_at if freq_at is not None else cur_at),
         1 if (queried or cur_q) else 0,
         total if total is not None else cur_total,
         1 if queried else 0, p))


# ---------- история частот (сезонность) ----------

HISTORY_MONTHS = 24        # окно истории: два года — видно и сезон, и рост год к году


def fetch_history(phrase, months=HISTORY_MONTHS, db_path=None):
    """Помесячная история частоты фразы. -> [{"ym": "2025-09", "y": 1247}, ...].

    Тот же эндпоинт, что и пул, отличается `pagetype=history`. Две ловушки провайдера:
    `end` в будущем -> «неверный период» (данные отстают на месяцы), а без периода
    отдаётся минимальное окно в три точки вместо истории."""
    qn = normalize(phrase)
    con = _cache_con(db_path)
    try:
        row = con.execute("SELECT series_json FROM history WHERE phrase = ?", (qn,)).fetchone()
    except sqlite3.OperationalError:
        con.execute(_SQL_HISTORY)
        row = None
    if row:
        con.close()
        return json.loads(row[0])
    if cache_only():
        con.close()
        raise RuntimeError("режим только кэш: истории для фразы нет")
    # верхняя граница — прошлый месяц: у провайдера данные отстают, будущее он отвергает
    end = datetime.date.today().replace(day=1) - datetime.timedelta(days=1)
    start = (end.replace(day=1) - datetime.timedelta(days=31 * (months - 1))).replace(day=1)
    data = _fetch_with_retry(qn, extra={"pagetype": "history", "period": "month",
                                        "start": start.strftime("%d.%m.%Y"),
                                        "end": end.strftime("%d.%m.%Y")})
    _check_xmlriver(data, qn)
    ts = (((data.get("graph") or {}).get("images") or {}).get("timeSeries") or {}) \
        .get("preparedValues", {}).get("absolute") or []
    series = [{"ym": f"{v['year']}-{v['month'] + 1:02d}", "y": int(v.get("y") or 0)}
              for v in ts if isinstance(v, dict) and "year" in v]
    if not series:
        con.close()
        raise RuntimeError(f"история пуста для {qn!r}")
    con.execute(_SQL_HISTORY)
    con.execute("INSERT OR REPLACE INTO history(phrase, series_json, fetched_at) VALUES (?, ?, ?)",
                (qn, json.dumps(series, ensure_ascii=False), int(time.time())))
    con.commit()
    con.close()
    return series


def season_stats(series):
    """Сводка по ряду: размах, пики, провалы, рост год к году."""
    ys = [v["y"] for v in series if v.get("y") is not None]
    if not ys:
        return {}
    lo, hi = min(ys), max(ys)
    by_month = {}
    for v in series:
        by_month.setdefault(v["ym"][-2:], []).append(v["y"])
    avg = {m: sum(x) / len(x) for m, x in by_month.items()}
    order = sorted(avg, key=lambda m: -avg[m])
    yoy = None
    if len(series) >= 24:
        first, last = sum(ys[:12]), sum(ys[-12:])
        yoy = round(last / first, 2) if first else None
    return {"min": lo, "max": hi, "amplitude": round(hi / lo, 1) if lo else None,
            "peak_months": order[:3], "trough_months": order[-3:],
            "last": ys[-1], "yoy": yoy, "points": len(ys)}


def _parse_pool(qn, data, limit):
    """Ответ XMLRiver -> (own_freq, refs) — своя частота и дети по убыванию частоты."""
    own_freq = next((f for p, f in parse_popular(data) if p == qn), None)
    refs = refinements(qn, data)
    refs.sort(key=lambda x: x[1], reverse=True)
    return own_freq, refs[:limit]


def fetch_phrase(phrase, limit=LIMIT, db_path=None):
    """ТОЛЬКО сеть/кэш + разбор, без записи в модель — можно гонять в executor-треде.
    Открывает собственное соединение к cache. -> (phrase, own_freq, refs, pool_ts).

    `pool_ts` — когда снят пул: по нему решается, вправе ли он переписать частоту (см.
    `upsert_node`). Кэш может быть старым, сеть — всегда свежая."""
    qn = normalize(phrase)
    con = _cache_con(db_path)
    try:
        data = fetch_wordstat(qn, con)
        row = con.execute("SELECT ts FROM cache WHERE query = ?", (qn,)).fetchone()
    finally:
        con.close()
    own_freq, refs = _parse_pool(qn, data, limit)
    return qn, own_freq, refs, (row[0] if row else None)


def save_phrase(con, phrase, own_freq, refs, pool_ts=None):
    """Запись результата фетча в модель (только loop-тред): узел queried=1 + рёбра к
    уточнениям. Статус не трогает — переходы FSM идут через set_status().
    `pool_ts` — возраст пула, из которого взяты частоты. -> (own_freq, total)."""
    qn = normalize(phrase)
    upsert_node(con, qn, freq=own_freq, queried=True, total=len(refs), freq_at=pool_ts)
    for p, f in refs:
        upsert_node(con, p, freq=f, freq_at=pool_ts)
        con.execute("INSERT OR IGNORE INTO edge(parent, child) VALUES (?, ?)", (qn, p))
    con.commit()
    return own_freq, len(refs)


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


def unqueried_frontier(con, root, floor=FLOOR):
    """Узлы поддерева, которые ОБЯЗАНЫ быть запрошены, но не запрошены: freq >= floor.

    Это же условие проверяет `repair_fully_loaded` — там оно ловит следствие, здесь служит
    условием остановки краула. Фразы под стоп-словами фронтиром не считаются: мы их
    сознательно не покупаем, и без этого краул гонялся бы за ними по кругу.
    -> список фраз по убыванию частоты."""
    stops = stop_filter(con)
    return [r[0] for r in con.execute(f"""
        WITH RECURSIVE sub(ph) AS (
          SELECT ? UNION SELECT e.child FROM sub JOIN edge e ON e.parent = sub.ph)
        SELECT n.phrase FROM sub JOIN node n ON n.phrase = sub.ph
        WHERE n.queried = 0 AND COALESCE(n.freq, 0) >= ?
        ORDER BY COALESCE(n.freq, 0) DESC""", (normalize(root), floor))
            if not is_stopped(r[0], stops)]


# ---------- стоп-слова ----------

STOP_KINDS = ("stop", "brand", "unwanted")

# Владелец списка исключений (design §4.10). Инвариант И1: ровно один из трёх, и `scope_id`
# непуст тогда и только тогда, когда владелец не общий.
STOP_SCOPES = ("global", "node", "domain")
GLOBAL_SCOPE = ("global", "")


def _scope(scope_kind=None, scope_id=None):
    """Нормализованная пара (владелец, id). Пустой владелец = общий список."""
    kind = (scope_kind or "global").strip().lower()
    if kind not in STOP_SCOPES:
        raise ValueError(f"неизвестная область стоп-слов: {scope_kind!r}")
    sid = normalize(scope_id) if kind != "global" else ""
    if kind != "global" and not sid:
        raise ValueError(f"область {kind} без адресата")
    return kind, sid


def check_scope(con, scope_kind, scope_id):
    """Проверить владельца перед записью (инварианты И2 и И5).

    Узел и домен должны существовать; у узла, принятого в домен, своего списка быть не
    может — иначе один и тот же запрет жил бы в двух местах и расходился.
    """
    kind, sid = _scope(scope_kind, scope_id)
    if kind == "node":
        if con.execute("SELECT 1 FROM node WHERE phrase = ?", (sid,)).fetchone() is None:
            raise ValueError(f"узла нет в дереве: {sid!r}")
        owner = domain_of(con, sid)
        if owner:
            raise ValueError(f"узел {sid!r} входит в домен {owner!r}: "
                             f"его стоп-слова живут у домена")
    elif kind == "domain":
        if con.execute("SELECT 1 FROM domain WHERE id = ?", (sid,)).fetchone() is None:
            raise ValueError(f"домена нет: {sid!r}")
    return kind, sid


def stopwords(con, scope_kind=None, scope_id=None):
    """Сохранённые исключения, новые сверху. Без области — весь список целиком.
    -> [{word, kind, scope_kind, scope_id, added_at}]"""
    sql = "SELECT word, kind, scope_kind, scope_id, added_at FROM stopword"
    args = ()
    if scope_kind is not None:
        kind, sid = _scope(scope_kind, scope_id)
        sql += " WHERE scope_kind = ? AND scope_id = ?"
        args = (kind, sid)
    return [{"word": r[0], "kind": r[1], "scope_kind": r[2], "scope_id": r[3], "added_at": r[4]}
            for r in con.execute(sql + " ORDER BY added_at DESC, word", args)]


def stop_stems(con):
    """Основы слов ОБЩЕГО списка — они действуют на любую фразу дерева.
    Словам узла и домена нужна область, поэтому им — `stop_filter`."""
    return frozenset(stem(w) for (w,) in con.execute(
        "SELECT word FROM stopword WHERE scope_kind = 'global'"))


def add_stopwords(con, items, scope_kind=None, scope_id=None):
    """items: [(слово, категория)]. Уже сохранённое у этого владельца не дублируется.
    -> сколько добавлено."""
    kind, sid = check_scope(con, scope_kind, scope_id)
    now = int(time.time())
    rows = [(normalize(w), k, kind, sid, now) for w, k in items
            if normalize(w) and k in STOP_KINDS]
    cur = con.executemany(
        "INSERT OR IGNORE INTO stopword(word, kind, scope_kind, scope_id, added_at) "
        "VALUES (?, ?, ?, ?, ?)", rows)
    con.commit()
    return cur.rowcount


def remove_stopwords(con, words, scope_kind=None, scope_id=None):
    kind, sid = _scope(scope_kind, scope_id)
    ws = [(normalize(w), kind, sid) for w in words if normalize(w)]
    cur = con.executemany(
        "DELETE FROM stopword WHERE word = ? AND scope_kind = ? AND scope_id = ?", ws)
    con.commit()
    return cur.rowcount


class StopFilter:
    """Что не покупаем — с учётом области действия (инвариант И4).

    Слово общего списка бьёт по любой фразе. Слово узла или домена — только внутри своей
    области. Область узла — сам узел и всё, что от него уточняется; принадлежность считаем
    по словам, а не обходом рёбер: уточнение у Вордстата всегда содержит слова родителя
    (на этом же построено `refinements`), поэтому проверка дешёвая и не зависит от того,
    каким рёбрами фраза оказалась в дереве. Область домена — объединение областей его
    ключей."""

    def __init__(self, rows):
        self.rows = list(rows)
        self._global = {}
        self._scoped = []
        by_scope = {}
        for r in self.rows:
            if r["scope_kind"] == "global":
                self._global.setdefault(stem(r["word"]), r)
            else:
                by_scope.setdefault((r["scope_kind"], r["scope_id"]), []).append(r)
        self._pending = by_scope

    def bind(self, areas):
        """areas: {(scope_kind, scope_id): [фраза, …]} — из чего состоит каждая область."""
        for key, rows in self._pending.items():
            words = [words_of(p) for p in areas.get(key, ()) if normalize(p)]
            if not words:
                continue      # область без ключей ничего не покрывает
            table = {}
            for r in rows:
                table.setdefault(stem(r["word"]), r)
            self._scoped.append((words, table))
        self._pending = {}
        return self

    def hit(self, phrase):
        """Первое сработавшее исключение или None. -> строка stopword."""
        ws = words_of(phrase)
        if self._global:
            common = ws & self._global.keys()
            if common:
                return self._global[min(common)]
        for areas, table in self._scoped:
            if not any(a <= ws for a in areas):
                continue
            common = ws & table.keys()
            if common:
                return table[min(common)]
        return None

    def words_for(self, phrase):
        """Слова, которые уже действуют на эту фразу — что не нужно классифицировать заново."""
        ws = words_of(phrase)
        out = [r["word"] for r in self._global.values()]
        for areas, table in self._scoped:
            if any(a <= ws for a in areas):
                out += [r["word"] for r in table.values()]
        return sorted(set(out))

    def __bool__(self):
        return bool(self._global or self._scoped)


def stop_areas(con):
    """Из чего состоит каждая область: узел — сам собой, домен — своими ключами."""
    areas = {}
    for phrase, in con.execute(
            "SELECT DISTINCT scope_id FROM stopword WHERE scope_kind = 'node'"):
        areas[("node", phrase)] = [phrase]
    for did, phrase in con.execute(
            "SELECT domain_id, phrase FROM domain_member ORDER BY position"):
        areas.setdefault(("domain", did), []).append(phrase)
    return areas


def stop_filter(con):
    """Готовый фильтр: снимок всех исключений вместе с их областями."""
    return StopFilter(stopwords(con)).bind(stop_areas(con))


def stop_scope_options(con, limit=200):
    """Кому можно адресовать список исключений — для выбора в UI.

    Общий список, все домены и корни дерева вне доменов. Узел внутри домена сюда не
    попадает (инвариант И2): его запреты живут у домена. Узел со своим списком показываем,
    даже если он давно перестал быть корнем, — иначе список стал бы недоступен.
    -> [{scope_kind, scope_id, name, count}]"""
    counts = {(r[0], r[1]): r[2] for r in con.execute(
        "SELECT scope_kind, scope_id, COUNT(*) FROM stopword GROUP BY scope_kind, scope_id")}
    out = [{"scope_kind": "global", "scope_id": "", "name": "Общий список",
            "count": counts.get(GLOBAL_SCOPE, 0)}]
    for did, name in con.execute("SELECT id, name FROM domain ORDER BY created_at, id"):
        out.append({"scope_kind": "domain", "scope_id": did, "name": name,
                    "count": counts.get(("domain", did), 0)})
    seen = set()
    for phrase, in con.execute(
            "SELECT n.phrase FROM node n "
            "WHERE NOT EXISTS (SELECT 1 FROM edge WHERE child = n.phrase) "
            "AND NOT EXISTS (SELECT 1 FROM domain_member dm WHERE dm.phrase = n.phrase) "
            "ORDER BY COALESCE(n.freq, 0) DESC LIMIT ?", (limit,)):
        seen.add(phrase)
        out.append({"scope_kind": "node", "scope_id": phrase, "name": phrase,
                    "count": counts.get(("node", phrase), 0)})
    for (sk, sid), n in sorted(counts.items()):
        if sk == "node" and sid not in seen:
            out.append({"scope_kind": "node", "scope_id": sid, "name": sid, "count": n})
    return out


def is_stopped(phrase, stops):
    """Фраза попадает под исключение, если хоть одно её слово — стоп-слово своей области.
    `stops` — либо `StopFilter`, либо множество основ общего списка (`stop_stems`)."""
    if isinstance(stops, StopFilter):
        return stops.hit(phrase) is not None
    return bool(stops) and bool(words_of(phrase) & stops)


def stopword_violations(con):
    """Нарушения инвариантов списка исключений — пусто, когда всё в порядке (testing-plan).
    -> [(правило, пояснение)]"""
    bad = []
    for r in con.execute("SELECT word, kind, scope_kind, scope_id FROM stopword"):
        word, kind, sk, sid = r
        if sk not in STOP_SCOPES:
            bad.append(("И1", f"{word!r}: неизвестный владелец {sk!r}"))
        elif (sk == "global") != (sid == ""):
            bad.append(("И1", f"{word!r}: владелец {sk!r} с адресатом {sid!r}"))
        if kind not in STOP_KINDS:
            bad.append(("И1", f"{word!r}: неизвестная категория {kind!r}"))
        if sk == "node":
            if con.execute("SELECT 1 FROM node WHERE phrase = ?", (sid,)).fetchone() is None:
                bad.append(("И5", f"{word!r}: узла {sid!r} нет в дереве"))
            elif domain_of(con, sid):
                bad.append(("И2", f"{word!r}: узел {sid!r} уже в домене "
                                  f"{domain_of(con, sid)!r}"))
        if sk == "domain" and con.execute("SELECT 1 FROM domain WHERE id = ?",
                                          (sid,)).fetchone() is None:
            bad.append(("И5", f"{word!r}: домена {sid!r} нет"))
    return bad


def word_stats(con, root, exclude=(), floor=FLOOR, cap=400):
    """Слова поддерева для разбора стоп-слов: {word, phrases, top_freq, examples}.

    Частоты НЕ складываем (широкое соответствие уже включает уточнения) — берём самую
    частотную фразу со словом и число фраз. Слова самого корня и уже сохранённые
    исключения не возвращаем: их классифицировать повторно незачем."""
    root = normalize(root)
    skip = set(words_of(root)) | {stem(w) for w in exclude}
    stats = {}
    for p, f in con.execute("""
            WITH RECURSIVE sub(ph) AS (
              SELECT ? UNION SELECT e.child FROM sub JOIN edge e ON e.parent = sub.ph)
            SELECT n.phrase, COALESCE(n.freq, 0) FROM sub JOIN node n ON n.phrase = sub.ph
            WHERE COALESCE(n.freq, 0) >= ?""", (root, floor)):
        for w in p.split():
            if stem(w) in skip:
                continue
            it = stats.setdefault(stem(w), {"word": w, "phrases": 0, "top_freq": 0,
                                            "examples": []})
            it["phrases"] += 1
            if f > it["top_freq"]:
                it["top_freq"] = f
                it["word"] = w        # представителем берём форму из самой частотной фразы
            if len(it["examples"]) < 3:
                it["examples"].append(p)
    out = sorted(stats.values(), key=lambda x: (-x["phrases"], -x["top_freq"]))
    return out[:cap], len(out)


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
    stops = stop_filter(con)         # что не покупаем: снимок на весь прогон
    skipped = 0
    if is_stopped(root, stops):
        # Сам корень под стоп-словом: не покупаем НИЧЕГО, включая его пул. Все уточнения такой
        # фразы содержат её слова, то есть тоже под запретом — покупать нечего и незачем.
        # Статус всё равно ставим: вопрос по ветке закрыт, и висеть в NEW ей ни к чему. Если
        # слово убрать из списка, ветка сама вернётся в LOADED — она незапрошена и выше FLOOR,
        # а это ровно то, что ловит repair_fully_loaded().
        phrases = subtree_phrases(con, root)
        con.executemany("UPDATE node SET status = 'FULLY_LOADED' "
                        "WHERE phrase = ? AND status IN ('NEW', 'LOADED')",
                        [(p,) for p in phrases])
        con.commit()
        return {"fetched": 0, "nodes": len(phrases), "errors": [], "rechecked": 0,
                "skipped": 1, "left": 0}
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
    rounds = 0

    while True:
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
            if p != root and is_stopped(p, stops):
                skipped += 1                      # стоп-слово: узел есть, пул не покупаем
                continue
            total += 1
            running[asyncio.ensure_future(fetch(p))] = p
        if not running:
            break
        finished, _ = await asyncio.wait(set(running), return_when=asyncio.FIRST_COMPLETED)
        for t in finished:
            p = running.pop(t)
            done += 1
            try:
                qn, own_freq, refs, pool_ts = t.result()
            except Exception as e:  # фетч упал: узел остаётся как был, идём дальше
                errors.append((p, f"{type(e).__name__}: {e}"))
                await progress(done, total, p)
                continue
            save_phrase(con, qn, own_freq, refs, pool_ts=pool_ts)
            for ch, _f in refs:
                if ch not in seen:
                    seen.add(ch)
                    queue.append(ch)
            await progress(done, total, qn)

      # Перепроверка фронтира перед тем, как объявить поддерево загруженным. Частота узла
      # могла пересечь FLOOR уже ПОСЛЕ решения по нему: фраза приходит из разных пулов с
      # разными значениями (у Вордстата они ползут), и решение принималось по первому
      # увиденному. Один раз это оставило 26 незапрошенных узлов под статусом FULLY_LOADED.
      failed_now = {p for p, _ in errors}
      late = [p for p in unqueried_frontier(con, root, floor)
              if p != root and p not in failed_now]
      if not late or rounds >= RECHECK_ROUNDS:
          break
      rounds += 1
      await progress(done, total, f"перепроверка фронтира: +{len(late)} узлов")
      seen.update(late)
      queue.extend(late)

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
    # `rechecked` — сколько кругов перепроверки понадобилось, `left` — что осталось
    # незапрошенным (не ноль = либо фетчи падали, либо кончились круги)
    return {"fetched": done, "nodes": len(phrases), "errors": errors, "rechecked": rounds,
            "skipped": skipped,
            "left": len(unqueried_frontier(con, root, floor))}


# ---------- данные для classify ----------

def repair_fully_loaded(con):
    """Инвариант: узел НЕ может быть FULLY_LOADED, если в его поддереве есть незагруженный
    узел с freq >= FLOOR. Нарушители сбрасываются в LOADED. -> сколько исправлено.

    Зачем: статус FULLY_LOADED ставит краул на всё поддерево, но узлы могут стать
    незагруженными ПОЗЖЕ — например при выбрасывании отравленной записи кэша. Тогда предки
    продолжают утверждать «загружено полностью», хотя это уже ложь, и full_load по ним
    даже не запустить (операция разрешена только из NEW/LOADED).
    Прецедент: чистка 97 сохранённых отказов XMLRiver оставила 72 таких предка.

    Фразы под стоп-словами дырой не считаются: их не покупают намеренно, иначе каждый старт
    сервера снимал бы FULLY_LOADED со всей отфильтрованной ветки."""
    stops = stop_filter(con)
    con.execute("CREATE TEMP TABLE IF NOT EXISTS _stopped(phrase TEXT PRIMARY KEY)")
    con.execute("DELETE FROM _stopped")
    if stops:
        holes = [(p,) for (p,) in con.execute(
            "SELECT phrase FROM node WHERE queried = 0 AND COALESCE(freq, 0) >= ?", (FLOOR,))
            if is_stopped(p, stops)]
        con.executemany("INSERT INTO _stopped(phrase) VALUES (?)", holes)
    cur = con.execute(f"""
        UPDATE node SET status = 'LOADED'
        WHERE status = 'FULLY_LOADED' AND EXISTS (
          WITH RECURSIVE sub(p) AS (
            SELECT node.phrase UNION SELECT e.child FROM edge e JOIN sub ON e.parent = sub.p)
          SELECT 1 FROM node n JOIN sub ON n.phrase = sub.p
          WHERE n.queried = 0 AND COALESCE(n.freq, 0) >= {FLOOR}
            AND n.phrase NOT IN (SELECT phrase FROM _stopped))""")
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


# ---------- подсказки поисковой строки (suggest) ----------

def save_suggest(con, source, region, by_phrase):
    """Записать подсказки: by_phrase = {фраза: [подсказка, ...]}.

    Порядок подсказок сохраняется как есть — он и есть сигнал популярности. Пустой список
    тоже пишется: «по этому корню не подсказывают ничего» — это результат замера, а не
    промах, и повторно платить за него незачем."""
    now = int(time.time())
    rows = [(normalize(phrase), source, str(region), json.dumps(items, ensure_ascii=False), now)
            for phrase, items in by_phrase.items()]
    if not rows:
        return 0
    try:
        con.executemany("INSERT OR REPLACE INTO suggest(phrase, source, region, items_json, "
                        "fetched_at) VALUES (?, ?, ?, ?, ?)", rows)
        con.commit()
    except Exception:
        con.rollback()
        raise
    return len(rows)


def load_suggest(con, phrases, source="google", region="2840"):
    """Сохранённые подсказки: {фраза: [подсказка, ...]}; чего нет — того нет в ответе."""
    out = {}
    for chunk in _chunks([normalize(p) for p in phrases], 400):
        marks = ",".join("?" * len(chunk))
        rows = con.execute(
            f"SELECT phrase, items_json FROM suggest WHERE source = ? AND region = ? "
            f"AND phrase IN ({marks})", (source, str(region), *chunk))
        for phrase, items in rows:
            out[phrase] = json.loads(items)
    return out


def missing_suggests(con, phrases, source="google", region="2840"):
    """Каких фраз ещё нет в таблице — только за них придётся платить."""
    have = load_suggest(con, phrases, source, region)
    seen, out = set(), []
    for p in phrases:
        n = normalize(p)
        if n and n not in have and n not in seen:
            seen.add(n)
            out.append(n)
    return out


def _suggest_request(phrases, source, region):
    """Одна отправка пакета в XMLRiver. Повтор — только на транзиентном отказе, как у пула.

    Провайдер отдаёт плоский список по всем фразам пакета сразу, без разбивки по исходной
    фразе; раскладываем обратно по префиксу — подсказка всегда начинается с того корня,
    к которому её предложили."""
    global _net_calls
    params = {"setab": "tips", "user": os.environ["XMLRIVER_USER"],
              "key": os.environ["XMLRIVER_KEY"], "loc" if source == "google" else "lr": region}
    last = None
    for attempt in range(len(RETRY_DELAYS) + 1):
        if attempt:
            time.sleep(RETRY_DELAYS[attempt - 1])
        with _net_lock:
            _net_calls += len(phrases)            # платится каждая фраза пакета, не запрос
        try:
            r = _client.post(SUGGEST_URL, params=params, json={"phrases": list(phrases)},
                             timeout=120)
            r.raise_for_status()
            data = r.json()
        except (httpx.TransportError, httpx.HTTPStatusError, json.JSONDecodeError) as e:
            last = e
            continue
        if is_transient(data):
            last = XmlRiverError(f"code={data.get('code')}: {data.get('error')}")
            continue
        _check_xmlriver(data, ", ".join(phrases[:3]))
        return data.get("phrases") or []
    raise XmlRiverError(f"подсказки не получены за {len(RETRY_DELAYS) + 1} попыток: {last}")


def _split_suggests(phrases, items):
    """Плоский ответ -> {фраза: [подсказки]}. Подсказка относится к самому длинному корню,
    с которого она начинается: «destiny matrix» и «destiny matrix money» оба префиксы, и без
    выбора длиннейшего весь хвост уехал бы к короткому.

    Граница слова обязательна: «destiny matrix 2026» начинается с «destiny matrix 20», и голый
    `startswith` отдавал запрос про год странице двадцатого аркана."""
    roots = sorted({normalize(p) for p in phrases}, key=len, reverse=True)
    out = {r: [] for r in roots}
    for raw in items:
        item = normalize(raw)
        for root in roots:
            if item == root or item.startswith(root + " "):
                out[root].append(raw)
                break
    return out


def fetch_suggests(phrases, source="google", region="2840", db_path=None, max_phrases=None):
    """Подсказки по списку фраз. Кэш первым: платим только за то, чего нет в таблице.

    `max_phrases` — потолок платных фраз за один вызов: пакет берётся целиком, поэтому
    ограничение считается по фразам, а не по запросам."""
    con = _cache_con(db_path)
    try:
        con.execute(_SQL_SUGGEST)
        order = [normalize(p) for p in phrases if normalize(p)]
        need = missing_suggests(con, order, source, region)
        if need and cache_only():
            raise RuntimeError(f"режим только кэш: подсказок нет для {len(need)} фраз")
        if max_phrases is not None:
            need = need[:max_phrases]
        for batch in _chunks(need, SUGGEST_BATCH):
            items = _suggest_request(batch, source, region)
            save_suggest(con, source, region, _split_suggests(batch, items))
        have = load_suggest(con, order, source, region)
    finally:
        con.close()
    return {p: have.get(p, []) for p in order}


def load_serp(con, phrase):
    """Сохранённая выдача узла: {engine: {found, docs, fetched_at}}; ничего нет -> {}."""
    out = {}
    for r in con.execute("SELECT engine, found, docs_json, fetched_at FROM serp WHERE phrase = ?",
                         (normalize(phrase),)):
        out[r[0]] = {"found": r[1], "docs": json.loads(r[2]), "fetched_at": r[3]}
    return out


# ---------- отчёты ----------

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


# ---------- SEO-домены ----------

def save_domain(con, domain_id, name, phrases):
    """Создать или заменить домен упорядоченным набором входных веток.

    Фраза домена может уже быть ребёнком другого корня или ещё не иметь
    своего пула. Домен не меняе edge: он лишь даёт UI набор точек входа. Неизвестную
    фразу заводим узлом NEW, чтобы её можно было загрузить штатной командой.
    """
    did = normalize(domain_id)
    title = re.sub(r"\s+", " ", (name or "").strip())
    members = list(dict.fromkeys(normalize(p) for p in phrases if normalize(p)))
    if not did or not title:
        raise ValueError("у домена должны быть id и название")
    if not members:
        raise ValueError("в домене должен быть хотя бы один ключ")
    now = int(time.time())
    con.execute(
        "INSERT INTO domain(id, name, created_at) VALUES (?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET name = excluded.name",
        (did, title, now),
    )
    for phrase in members:
        upsert_node(con, phrase)
    con.execute("DELETE FROM domain_member WHERE domain_id = ?", (did,))
    con.executemany(
        "INSERT INTO domain_member(domain_id, phrase, position) VALUES (?, ?, ?)",
        [(did, phrase, position) for position, phrase in enumerate(members)],
    )
    moved = 0
    for phrase in members:
        moved += adopt_node_stopwords(con, phrase, did)
    con.commit()
    return {"id": did, "name": title, "members": members, "stopwords_moved": moved}


def domain_of(con, phrase):
    """id домена, в который принят узел, или None."""
    row = con.execute("SELECT domain_id FROM domain_member WHERE phrase = ?",
                      (normalize(phrase),)).fetchone()
    return row[0] if row else None


def domain_id_for(name, taken=()):
    """Опорный id домена из его названия: латиница и цифры как есть, кириллица —
    транслитом, остальное — дефис. Занятый id разводим суффиксом."""
    tr = {"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
          "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
          "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
          "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
          "я": "ya"}
    out = "".join(tr.get(ch, ch if ch.isalnum() and ch.isascii() else "-")
                  for ch in normalize(name))
    base = re.sub(r"-+", "-", out).strip("-") or "domain"
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def create_domain(con, name, phrases):
    """Новый домен из перечисленных узлов. id выводится из названия. -> save_domain."""
    taken = {r[0] for r in con.execute("SELECT id FROM domain")}
    members = [normalize(p) for p in phrases if normalize(p)]
    for phrase in members:
        owner = domain_of(con, phrase)
        if owner:
            raise ValueError(f"узел {phrase!r} уже в домене {owner!r}")
    return save_domain(con, domain_id_for(name, taken), name, members)


def add_domain_member(con, domain_id, phrase):
    """Принять узел в существующий домен: он встаёт в конец, его стоп-слова переходят
    домену (инвариант И3). -> {id, name, members, stopwords_moved}"""
    did = normalize(domain_id)
    qn = normalize(phrase)
    row = con.execute("SELECT id, name FROM domain WHERE id = ?", (did,)).fetchone()
    if row is None:
        raise ValueError(f"домена нет: {domain_id!r}")
    if not qn:
        raise ValueError("нужна фраза узла")
    owner = domain_of(con, qn)
    if owner == did:
        raise ValueError(f"узел {qn!r} уже в домене {did!r}")
    if owner:
        raise ValueError(f"узел {qn!r} уже в домене {owner!r}")
    upsert_node(con, qn)
    pos = con.execute("SELECT COALESCE(MAX(position), -1) + 1 FROM domain_member "
                      "WHERE domain_id = ?", (did,)).fetchone()[0]
    con.execute("INSERT INTO domain_member(domain_id, phrase, position) VALUES (?, ?, ?)",
                (did, qn, pos))
    moved = adopt_node_stopwords(con, qn, did)
    con.commit()
    members = [r[0] for r in con.execute(
        "SELECT phrase FROM domain_member WHERE domain_id = ? ORDER BY position", (did,))]
    return {"id": did, "name": row["name"] if hasattr(row, "keys") else row[1],
            "members": members, "stopwords_moved": moved}


def adopt_node_stopwords(con, phrase, domain_id):
    """Перенести собственный список узла на домен (инварианты И2 и И3).

    Слово, которое у домена уже есть, дублем не заводим: побеждает запись домена —
    она старше и её категорию выбирал человек, глядя на весь домен целиком.
    -> сколько слов переехало."""
    qn = normalize(phrase)
    did = normalize(domain_id)
    rows = con.execute("SELECT word, kind, added_at FROM stopword "
                       "WHERE scope_kind = 'node' AND scope_id = ?", (qn,)).fetchall()
    if not rows:
        return 0
    cur = con.executemany(
        "INSERT OR IGNORE INTO stopword(word, kind, scope_kind, scope_id, added_at) "
        "VALUES (?, ?, 'domain', ?, ?)",
        [(r[0], r[1], did, r[2]) for r in rows])
    moved = cur.rowcount
    con.execute("DELETE FROM stopword WHERE scope_kind = 'node' AND scope_id = ?", (qn,))
    return moved


def ensure_default_domains(con):
    """Завести штатный домен только в базе проекта «Матрица судьбы».

    Проверка опорного узла не даёт этой предметной конфигурации появиться в чужой
    или пустой БД. Повторный запуск идемпотентен.
    """
    anchor = DESTINY_MATRIX_DOMAIN_KEYS[0]
    if con.execute("SELECT 1 FROM node WHERE phrase = ?", (anchor,)).fetchone() is None:
        return False
    save_domain(con, DESTINY_MATRIX_DOMAIN_ID, DESTINY_MATRIX_DOMAIN_NAME,
                DESTINY_MATRIX_DOMAIN_KEYS)
    return True


def domain_groups(con):
    """Все домены с объектами узлов в ручном порядке для WS/UI."""
    out = []
    for domain in con.execute("SELECT id, name FROM domain ORDER BY created_at, id"):
        rows = con.execute(
            f"SELECT {_NODE_OBJ_COLS} FROM domain_member dm "
            "JOIN node n ON n.phrase = dm.phrase "
            "WHERE dm.domain_id = ? ORDER BY dm.position",
            (domain["id"],),
        ).fetchall()
        out.append({"id": domain["id"], "name": domain["name"],
                    "members": [_node_obj(row) for row in rows]})
    return out


# ---------- корни и проекция детей ----------

def root_candidates(con, limit=50):
    """Не входящие в домены корни-кандидаты (tech §6.2).

    Члены домена уже показаны в его рамке, поэтому в списке отдельных корней их
    не дублируем. -> [объект узла] без children.
    """
    rows = con.execute(
        f"SELECT {_NODE_OBJ_COLS} FROM node n "
        "WHERE NOT EXISTS (SELECT 1 FROM edge WHERE child = n.phrase) "
        "AND NOT EXISTS (SELECT 1 FROM domain_member dm WHERE dm.phrase = n.phrase) "
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
    probes = {r[0] for r in con.execute("SELECT query FROM probe")}
    for row in con.execute("SELECT query, response, ts FROM cache").fetchall():
        q, resp, ts = row[0], row[1], row[2]
        try:
            data = json.loads(resp)
        except (ValueError, TypeError):
            continue
        qn = normalize(q)
        if qn in probes:
            continue
        own_freq, refs = _parse_pool(qn, data, limit)
        # возраст пула передаём так же, как при живом фетче: одна и та же фраза приходит из
        # разных пулов с разными числами (у Вордстата частота ползёт), и побеждать должен
        # свежий, а не тот, что обработали последним. Без этого пересборка даёт другое дерево.
        upsert_node(con, qn, freq=own_freq, queried=True, total=len(refs), freq_at=ts)
        for p, f in refs:
            upsert_node(con, p, freq=f, freq_at=ts)
            con.execute("INSERT OR IGNORE INTO edge(parent, child) VALUES (?, ?)", (qn, p))
    con.commit()


def _maybe_backfill(con):
    if con.execute("SELECT COUNT(*) FROM node").fetchone()[0] == 0:
        if con.execute("SELECT COUNT(*) FROM cache").fetchone()[0] > 0:
            rebuild_model_from_cache(con)
