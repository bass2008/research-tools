#!/usr/bin/env python3
"""
Ядро проекта: клиент XMLRiver Wordstat с кэшем в SQLite + утилиты дерева.
Используется и скриптами, и FastAPI-сервером.
"""
import json
import os
import re
import sqlite3
from pathlib import Path

import httpx

ROOT = Path(__file__).parent
BASE_URL = "http://xmlriver.com/wordstat/new/json"
DB_PATH = ROOT / "semcore.db"

_client = httpx.Client(timeout=30)


def load_env(path=ROOT / ".env"):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def connect(db_path=DB_PATH):
    con = sqlite3.connect(db_path)
    # сырой кэш ответов XMLRiver (экономия запросов)
    con.execute("""CREATE TABLE IF NOT EXISTS cache (
        query TEXT PRIMARY KEY, response TEXT NOT NULL, ts INTEGER NOT NULL)""")
    # модель: фразы (узлы) + рёбра «родитель -> уточнение из его пула»
    con.execute("""CREATE TABLE IF NOT EXISTS node (
        phrase TEXT PRIMARY KEY,
        freq INTEGER,
        queried INTEGER NOT NULL DEFAULT 0,       -- пул фразы уже запрашивался
        total_refinements INTEGER NOT NULL DEFAULT 0,
        queried_at INTEGER,
        score REAL, verdict TEXT, note TEXT)""")  # score/verdict/note — задел под стадию 3
    con.execute("""CREATE TABLE IF NOT EXISTS edge (
        parent TEXT NOT NULL, child TEXT NOT NULL, PRIMARY KEY (parent, child))""")
    con.execute("CREATE INDEX IF NOT EXISTS idx_edge_parent ON edge(parent)")
    con.commit()
    _maybe_backfill(con)
    return con


def normalize(s):
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def fetch_wordstat(query, con=None):
    """Ответ XMLRiver по фразе. Кэш в semcore.db: повторный запрос бесплатен."""
    q = normalize(query)
    own = con is None
    if own:
        con = connect()
    try:
        row = con.execute("SELECT response FROM cache WHERE query = ?", (q,)).fetchone()
        if row:
            return json.loads(row[0])
        load_env()
        r = _client.get(BASE_URL, params={
            "user": os.environ["XMLRIVER_USER"],
            "key": os.environ["XMLRIVER_KEY"],
            "query": q,
        })
        r.raise_for_status()
        data = r.json()
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
        cur_freq, cur_q, cur_total = row
        con.execute(
            "UPDATE node SET freq = ?, queried = ?, total_refinements = ?, "
            "queried_at = CASE WHEN ? = 1 THEN strftime('%s','now') ELSE queried_at END "
            "WHERE phrase = ?",
            (freq if freq is not None else cur_freq,
             1 if (queried or cur_q) else 0,
             total if total is not None else cur_total,
             1 if queried else 0, p))


def load_phrase(con, phrase, limit=2000):
    """Запросить пул фразы (кэш) и записать в модель: узел queried=1 + рёбра к
    уточнениям (весь пул, до limit). Возвращает (own_freq, total)."""
    qn = normalize(phrase)
    data = fetch_wordstat(qn, con)
    own_freq = next((f for p, f in parse_popular(data) if p == qn), None)
    refs = refinements(qn, data)
    refs.sort(key=lambda x: x[1], reverse=True)
    refs = refs[:limit]
    upsert_node(con, qn, freq=own_freq, queried=True, total=len(refs))
    for p, f in refs:
        upsert_node(con, p, freq=f)
        con.execute("INSERT OR IGNORE INTO edge(parent, child) VALUES (?, ?)", (qn, p))
    con.commit()
    return own_freq, len(refs)


def project(con, phrase):
    """Проекция сохранённого пула фразы в фронт-формат: локальная вложенность по
    словам + метки cached(queried)/childCount(total_refinements)."""
    qn = normalize(phrase)
    rows = con.execute(
        "SELECT n.phrase, n.freq, n.queried, n.total_refinements "
        "FROM edge e JOIN node n ON n.phrase = e.child WHERE e.parent = ?", (qn,)).fetchall()
    refs = [(r[0], r[1]) for r in rows]
    meta = {r[0]: (r[2], r[3]) for r in rows}

    def ser(nodes):
        out = []
        for nd in sorted(nodes, key=lambda x: -x["freq"]):
            q, tot = meta.get(nd["phrase"], (0, 0))
            out.append({
                "phrase": nd["phrase"], "freq": nd["freq"],
                "cached": bool(q), "childCount": tot,
                "children": ser(nd["children"]),
            })
        return out

    return ser(build_forest(refs))


def rebuild_model_from_cache(con, limit=2000):
    """Одноразовый бэкфилл модели из уже накопленного кэша ответов."""
    for q, resp in con.execute("SELECT query, response FROM cache").fetchall():
        try:
            data = json.loads(resp)
        except (ValueError, TypeError):
            continue
        qn = normalize(q)
        own_freq = next((f for p, f in parse_popular(data) if p == qn), None)
        refs = refinements(qn, data)
        refs.sort(key=lambda x: x[1], reverse=True)
        refs = refs[:limit]
        upsert_node(con, qn, freq=own_freq, queried=True, total=len(refs))
        for p, f in refs:
            upsert_node(con, p, freq=f)
            con.execute("INSERT OR IGNORE INTO edge(parent, child) VALUES (?, ?)", (qn, p))
    con.commit()


def _maybe_backfill(con):
    if con.execute("SELECT COUNT(*) FROM node").fetchone()[0] == 0:
        if con.execute("SELECT COUNT(*) FROM cache").fetchone()[0] > 0:
            rebuild_model_from_cache(con)
