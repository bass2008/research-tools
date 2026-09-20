#!/usr/bin/env python3
"""Совпадает ли намерение выдачи с тем, что у нас за страница.

Ключ может быть живым и при этом чужим: по «destiny matrix 5» ищут не статью, а расчёт, и
тогда статья встанет под калькуляторы и не соберёт ничего. Проверяется по одному главному
запросу на тип страницы — аркан, позиция, год, хвост, хаб, пересечение; при расхождении
внутри типа добираются ещё два запроса этого типа.

Выдача ложится в оплаченный кэш `serp` (ключ «фраза + движок»), повтор бесплатен.

    python tools/seo/serp-intent.py                 # отчёт по тому, что уже куплено
    python tools/seo/serp-intent.py --fetch         # докупить недостающее
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from xml.etree import ElementTree as ET

import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import wscore  # noqa: E402
import tasks   # noqa: E402  — разбор ответа и параметры запроса берём оттуда

GOOGLE_LOC_US = 2840
OUT = ROOT / "tools/seo/audit/serp-intent.json"

# Один главный запрос на тип страницы. Тип — не каталог, а способ задать вопрос поиску:
# у пересечения и позиции разная форма, и намерение у них может разойтись.
PROBES = {
    "arcanum": "destiny matrix 5",
    "position": "destiny matrix money",
    "year": "destiny matrix year 2026",
    "tail": "destiny matrix karmic tail",
    "hub": "destiny matrix how to read",
    "crossing": "destiny matrix money line 8",
}

# Добор по типу, где намерение разошлось с нашим: один запрос мог попасть на нетипичную
# выдачу, и два соседних показывают, правило это или случай.
DEEPER = {
    "year": ["destiny matrix year 7", "destiny matrix year forecast"],
    "tail": ["destiny matrix karmic tail 3", "karmic tail 15 20 5"],
}

# Что стоит в выдаче. Калькулятор виден по адресу и заголовку: «calculate», «calculator»,
# «online», форма расчёта. Статья — разбор темы. Список площадок здесь не нужен: решает то,
# что предлагает страница, а не чей домен.
CALC = re.compile(r"calculat|online|free\s+(?:reading|chart)|generator|расч", re.I)
ARTICLE = re.compile(
    r"meaning|what\s+(?:is|it|this|does)|how\s+to|guide|explain|interpret|understanding|"
    r"knowledge\s+base|forecast|report|значен", re.I)


def probe_serp(phrase, engine):
    wscore.load_env()
    url = os.environ.get("XMLRIVER_YANDEX_URL" if engine == "yandex" else "XMLRIVER_GOOGLE_URL")
    if not url:
        raise RuntimeError(f"не задан URL выдачи для движка {engine}")
    params = {"user": os.environ.get("XMLRIVER_USER", ""),
              "key": os.environ.get("XMLRIVER_KEY", ""),
              "query": phrase, "groupby": tasks.SERP_TOP}
    if engine == "yandex":
        params["lr"] = tasks.YANDEX_LR
    else:
        params["loc"] = GOOGLE_LOC_US
        params["hl"] = "en"
    # XMLRiver отдаёт «Выполните перезапрос» (code 500) на исправные запросы — ошибка
    # транзиентная, и одной серии пауз ей мало. Серия повторяется трижды.
    delays = list(wscore.RETRY_DELAYS) * 3
    last = None
    for attempt in range(len(delays) + 1):
        if attempt:
            time.sleep(delays[attempt - 1])
        try:
            r = httpx.get(url, params=params, timeout=60)
            r.raise_for_status()
            return tasks._parse_serp(r.text)
        except (wscore.XmlRiverError, httpx.TransportError, httpx.HTTPStatusError, ET.ParseError) as e:
            last = e
    raise RuntimeError(f"выдача {engine} по {phrase!r} не получена за "
                       f"{len(delays) + 1} попыток: {last}")


def ensure(phrase, fetch):
    con = wscore._cache_con()
    try:
        have = wscore.load_serp(con, phrase)
        if all(e in have for e in wscore.SERP_ENGINES):
            return have
        if not fetch:
            return {}
        serps = {e: probe_serp(phrase, e) for e in wscore.SERP_ENGINES}
        wscore.save_serp(con, phrase, serps)
        return wscore.load_serp(con, phrase)
    finally:
        con.close()


def classify(doc):
    """Что предлагает документ — расчёт или чтение.

    Решает заголовок, а не сниппет: сайты-калькуляторы пишут «free calculator» в описании
    почти каждой своей страницы, включая статьи, и по сниппету калькулятором оказывается вся
    выдача. Признак статьи сильнее признака расчёта: «Karmic Tail — What It Is, How to Find
    Yours» это разбор темы, хотя слово «find» в нём есть.
    """
    title = doc.get("title", "") or ""
    if ARTICLE.search(title):
        return "article"
    if CALC.search(title):
        return "calculator"
    if ARTICLE.search(doc.get("snippet", "") or ""):
        return "article"
    return "other"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true", help="докупить недостающие выдачи")
    args = ap.parse_args()

    report = {}
    failed = []
    for kind, phrase in PROBES.items():
        try:
            have = ensure(phrase, args.fetch)
        except RuntimeError as e:
            # Одна недобравшаяся выдача не должна ронять весь замер: остальные типы проверяются,
            # а эта фраза попадает в отчёт как непроверенная.
            print(f"{kind:9} {phrase:32} — НЕ ПОЛУЧЕНА: {e}")
            report[kind] = {"query": phrase, "docs": 0, "verdict": "выдача не получена",
                            "error": str(e), "top": []}
            failed.append(kind)
            continue
        docs = (have.get("google") or {}).get("docs") or []
        kinds = [classify(d) for d in docs]
        report[kind] = {
            "query": phrase,
            "docs": len(docs),
            "articles": kinds.count("article"),
            "calculators": kinds.count("calculator"),
            "other": kinds.count("other"),
            "top": [{"rank": d.get("rank"), "kind": k, "url": d.get("url"),
                     "title": d.get("title")} for d, k in zip(docs, kinds)],
        }
        verdict = "нет выдачи" if not docs else (
            "совпадает" if kinds.count("calculator") < len(docs) / 2 else "выдача под калькуляторы")
        report[kind]["verdict"] = verdict
        print(f"{kind:9} {phrase:32} док.{len(docs):3}  статей {kinds.count('article'):2}  "
              f"калькуляторов {kinds.count('calculator'):2}  — {verdict}")

    # Добор по расходящимся типам: выводы делаются по трём запросам, а не по одному.
    for kind, extra in DEEPER.items():
        if report.get(kind, {}).get("verdict") != "выдача под калькуляторы":
            continue
        report[kind]["deeper"] = []
        for phrase in extra:
            try:
                have = ensure(phrase, args.fetch)
            except RuntimeError as e:
                report[kind]["deeper"].append({"query": phrase, "error": str(e)})
                print(f"{kind:9} {phrase:32} — НЕ ПОЛУЧЕНА")
                continue
            docs = (have.get("google") or {}).get("docs") or []
            kinds = [classify(d) for d in docs]
            row = {"query": phrase, "docs": len(docs), "articles": kinds.count("article"),
                   "calculators": kinds.count("calculator"),
                   "top": [{"rank": d.get("rank"), "kind": k, "url": d.get("url"),
                            "title": d.get("title")} for d, k in zip(docs, kinds)]}
            report[kind]["deeper"].append(row)
            print(f"{kind:9} {phrase:32} док.{len(docs):3}  статей {kinds.count('article'):2}  "
                  f"калькуляторов {kinds.count('calculator'):2}")

    if failed:
        print(f"не проверено типов: {len(failed)} ({', '.join(failed)})")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"отчёт: {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
