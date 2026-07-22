#!/usr/bin/env python3
"""
Сборка семантического ядра + частоты через XMLRiver (метод Wordstat).

Стадии 1-2:
  1. seed-фразы (--seeds / --seeds-file) — узкое стартовое ядро
  2. расширение вглубь (BFS): на каждом уровне берём топ целевых фраз (popular,
     т.е. содержащих запрос) и запрашиваем их дальше. associations (широкие
     ассоциации) собираем, но НЕ раскрываем — они шумные.
  Частоты приходят вместе с фразами в том же ответе.

Жёсткий лимит --max-requests ограничивает число реальных обращений к API.
Кэш в SQLite: повторные прогоны не тратят запросы.

Выгрузка: cores/<slug>.csv и cores/<slug>.json — формат пригоден для
последующего объединения/дорасширения. Источник частот сменный (позже —
официальный Wordstat API вместо XMLRiver).
"""
import argparse
import asyncio
import csv
import json
import os
import re
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx

BASE_URL = "http://xmlriver.com/wordstat/new/json"
ROOT = Path(__file__).parent

# грубая транслитерация для имени файла
_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya", " ": "_",
}


def slugify(text):
    text = text.strip().lower()
    out = "".join(_TRANSLIT.get(ch, ch) for ch in text)
    out = re.sub(r"[^a-z0-9_]+", "_", out).strip("_")
    return out or "core"


def load_env(path=ROOT / ".env"):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


# ---------- хранилище / кэш ----------

def init_db(db_path):
    con = sqlite3.connect(db_path)
    con.execute("""
        CREATE TABLE IF NOT EXISTS cache (
            query TEXT PRIMARY KEY,
            response TEXT NOT NULL,
            ts INTEGER NOT NULL
        )""")
    con.execute("""
        CREATE TABLE IF NOT EXISTS keywords (
            phrase TEXT NOT NULL,
            topic  TEXT NOT NULL,
            freq   INTEGER NOT NULL,
            kind   TEXT,          -- association | popular
            seed   TEXT,          -- из какого запроса пришла
            level  INTEGER,       -- на каком уровне расширения найдена
            PRIMARY KEY (phrase, topic)
        )""")
    con.commit()
    return con


def cache_get(con, query):
    row = con.execute("SELECT response FROM cache WHERE query = ?", (query,)).fetchone()
    return json.loads(row[0]) if row else None


def cache_put(con, query, data):
    con.execute(
        "INSERT OR REPLACE INTO cache (query, response, ts) VALUES (?, ?, ?)",
        (query, json.dumps(data, ensure_ascii=False), int(time.time())),
    )
    con.commit()


# ---------- клиент XMLRiver ----------

async def fetch_wordstat(client, con, query, counter, max_requests, retries=3):
    """Один запрос к XMLRiver Wordstat. Кэш бесплатно; реальные вызовы считаются
    в counter и жёстко ограничены max_requests."""
    cached = cache_get(con, query)
    if cached is not None:
        return cached
    if counter["n"] >= max_requests:
        return None
    counter["n"] += 1  # резервируем слот до await, чтобы не превысить лимит
    params = {
        "user": os.environ["XMLRIVER_USER"],
        "key": os.environ["XMLRIVER_KEY"],
        "query": query,
    }
    for attempt in range(retries):
        try:
            r = await client.get(BASE_URL, params=params, timeout=30)
            r.raise_for_status()
            data = r.json()
            cache_put(con, query, data)
            return data
        except (httpx.HTTPError, json.JSONDecodeError) as e:
            if attempt == retries - 1:
                print(f"  ! ошибка по '{query}': {type(e).__name__}: {e}", file=sys.stderr)
                return {}
            await asyncio.sleep(2 ** attempt)
    return {}


def normalize(text):
    return re.sub(r"\s+", " ", text.strip().lower())


def parse_response(data):
    """associations + popular -> [(phrase, freq, kind)]."""
    out = []
    for kind_key in ("associations", "popular"):
        for item in data.get(kind_key, []) or []:
            phrase = normalize(item.get("text", ""))
            if not phrase:
                continue
            try:
                freq = int(item.get("value", 0))
            except (ValueError, TypeError):
                freq = 0
            kind = "association" if item.get("isAssociations") else "popular"
            out.append((phrase, freq, kind))
    return out


# ---------- пайплайн ----------

async def build_core(topic, seeds, db_path, concurrency, min_freq,
                     max_requests, depth, expand_top):
    con = init_db(db_path)
    sem = asyncio.Semaphore(concurrency)
    counter = {"n": 0}
    collected = {}          # phrase -> {freq, kind, seed, level}
    queried = set()

    async with httpx.AsyncClient() as client:
        async def fetch_one(query, level):
            async with sem:
                data = await fetch_wordstat(client, con, query, counter, max_requests)
            if data is None:
                return None
            return query, level, parse_response(data)

        frontier = list(dict.fromkeys(normalize(s) for s in seeds))
        for level in range(1, depth + 1):
            remaining = max_requests - counter["n"]
            if remaining <= 0:
                break
            batch = [q for q in frontier if q not in queried][:remaining]
            if not batch:
                break
            for q in batch:
                queried.add(q)
            results = await asyncio.gather(*(fetch_one(q, level) for q in batch))

            level_popular = []
            for res in results:
                if res is None:
                    continue
                query, lvl, phrases = res
                for phrase, freq, kind in phrases:
                    if freq < min_freq:
                        continue
                    prev = collected.get(phrase)
                    if prev is None or freq > prev["freq"]:
                        collected[phrase] = {"freq": freq, "kind": kind,
                                             "seed": query, "level": lvl}
                    if kind == "popular":
                        level_popular.append((phrase, freq))

            # следующий фронт — топ целевых (popular) фраз, ещё не запрошенных
            level_popular.sort(key=lambda x: x[1], reverse=True)
            frontier = [p for p, _ in level_popular if p not in queried][:expand_top]
            print(f"  уровень {level}: запросов {counter['n']}, "
                  f"фраз в ядре {len(collected)}")

    for phrase, m in collected.items():
        con.execute(
            "INSERT OR REPLACE INTO keywords "
            "(phrase, topic, freq, kind, seed, level) VALUES (?, ?, ?, ?, ?, ?)",
            (phrase, topic, m["freq"], m["kind"], m["seed"], m["level"]),
        )
    con.commit()
    con.close()
    return collected, counter["n"]


def export(topic, collected, requests_made, out_dir):
    out_dir = Path(out_dir)
    out_dir.mkdir(exist_ok=True)
    slug = slugify(topic)
    rows = sorted(collected.items(), key=lambda kv: kv[1]["freq"], reverse=True)

    csv_path = out_dir / f"{slug}.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["phrase", "freq", "kind", "seed", "level"])
        for phrase, m in rows:
            w.writerow([phrase, m["freq"], m["kind"], m["seed"], m["level"]])

    json_path = out_dir / f"{slug}.json"
    payload = {
        "topic": topic,
        "source": "xmlriver",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "requests_made": requests_made,
        "count": len(rows),
        "keywords": [
            {"phrase": p, "freq": m["freq"], "kind": m["kind"],
             "seed": m["seed"], "level": m["level"]}
            for p, m in rows
        ],
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return csv_path, json_path


def main():
    load_env()
    if not os.environ.get("XMLRIVER_USER") or not os.environ.get("XMLRIVER_KEY"):
        sys.exit("Нет XMLRIVER_USER / XMLRIVER_KEY (проверь .env)")

    ap = argparse.ArgumentParser(description="Семантическое ядро + частоты через XMLRiver")
    ap.add_argument("--topic", required=True, help="Тема (метка прогона)")
    ap.add_argument("--seeds", help="Seed-фразы через запятую")
    ap.add_argument("--seeds-file", help="Файл с seed-фразами (по одной на строку)")
    ap.add_argument("--out-dir", default="cores", help="Папка для выгрузки ядер")
    ap.add_argument("--db", default="semcore.db", help="SQLite файл (кэш + keywords)")
    ap.add_argument("--concurrency", type=int, default=5, help="Параллельных запросов")
    ap.add_argument("--min-freq", type=int, default=0, help="Порог частоты для отсева")
    ap.add_argument("--max-requests", type=int, default=100, help="Жёсткий лимит запросов к API")
    ap.add_argument("--depth", type=int, default=2, help="Глубина расширения (уровней BFS)")
    ap.add_argument("--expand-top", type=int, default=500,
                    help="Сколько топ-фраз раскрывать на следующем уровне")
    args = ap.parse_args()

    seeds = []
    if args.seeds:
        seeds += [normalize(s) for s in args.seeds.split(",") if s.strip()]
    if args.seeds_file:
        seeds += [normalize(l) for l in Path(args.seeds_file).read_text(encoding="utf-8").splitlines() if l.strip()]
    seeds = list(dict.fromkeys(seeds))
    if not seeds:
        sys.exit("Нужны seed-фразы: --seeds или --seeds-file")

    print(f"Тема: {args.topic}")
    print(f"seed-фраз: {len(seeds)} | depth={args.depth} | лимит запросов={args.max_requests}")
    collected, requests_made = asyncio.run(
        build_core(args.topic, seeds, args.db, args.concurrency, args.min_freq,
                   args.max_requests, args.depth, args.expand_top)
    )
    csv_path, json_path = export(args.topic, collected, requests_made, args.out_dir)
    print(f"\nГотово: {len(collected)} фраз, потрачено {requests_made} запросов")
    print(f"  {csv_path}")
    print(f"  {json_path}")


if __name__ == "__main__":
    main()
