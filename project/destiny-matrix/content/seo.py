"""Заголовки, описания и запросы для страниц энциклопедии.

Описание страницы собирается из её собственного текста, а не из шаблона: у 231 сочетания
шаблонное описание дало бы 231 почти одинаковый сниппет, и Яндекс склеил бы страницы.
Запросы — длинный хвост из `docs/product-checks-2.md`: числовые формулировки («14 аркан в
отношениях») по рекламе не кликают, но именно их ищут в органике.
"""
from __future__ import annotations

import re

TITLE_LIMIT = 70
DESC_LIMIT = 180


def first_sentence(text: str, limit: int = 160) -> str:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    out = parts[0].strip()
    for nxt in parts[1:]:
        if len(out) >= 110:
            break
        out = f"{out} {nxt.strip()}"
    if len(out) > limit:
        cut = out[:limit].rsplit(" ", 1)[0]
        out = cut.rstrip(",;:—-") + "…"
    return out


def _dedup(items: list[str]) -> list[str]:
    seen: dict[str, None] = {}
    for it in items:
        key = it.strip().lower()
        if key and key not in seen:
            seen[key] = None
    return list(seen)


def arcanum(entry: dict) -> dict:
    n, title = entry["n"], entry["title"]
    low = title.lower()
    queries = [
        f"{n} аркан",
        f"{n} аркан значение",
        f"{n} аркан в матрице судьбы",
        f"{n} аркан {low}",
        f"аркан {low} значение",
        f"{n} аркан в отношениях",
        f"{n} аркан деньги",
        f"{n} аркан предназначение",
        f"{n} аркан в центре матрицы",
        f"{n} аркан плюсы и минусы",
        f"что означает {n} аркан",
    ] + list(entry.get("queries", ()))
    return {
        "title": f"{n} аркан — {title}: значение в матрице судьбы",
        "description": entry["seo_description"],
        "queries": _dedup(queries),
    }


def combination(a: dict, b: dict, pair: dict) -> dict:
    na, nb = a["n"], b["n"]
    queries = [
        f"сочетание {na} и {nb} аркана",
        f"{na} и {nb} аркан",
        f"{na} и {nb} аркан в матрице судьбы",
        f"{na} {nb} аркан совместимость",
        f"{na} и {nb} аркан вместе",
        f"{a['title'].lower()} и {b['title'].lower()} в матрице судьбы",
        f"аркан {na} с арканом {nb}",
    ]
    return {
        "title": f"Сочетание {na} и {nb} аркана — {a['title']} и {b['title']}",
        "description": first_sentence(pair["paragraphs"][0], DESC_LIMIT),
        "queries": _dedup(queries),
    }


def position(entry: dict, kind: str) -> dict:
    base = list(entry.get("queries", ()))
    if kind == "section":
        base += [f"{entry['title'].lower()} в матрице судьбы"]
    else:
        base += [f"{entry['title'].lower()} матрица судьбы"]
    return {
        "title": entry["seo_title"],
        "description": entry["seo_description"],
        "queries": _dedup(base),
    }


def chakra(entry: dict) -> dict:
    low = entry["title"].lower()
    queries = [
        f"{low} в матрице судьбы",
        f"{low} аркан",
        f"{low} значение чакры",
        f"чакра {low} расчет по дате рождения",
    ] + list(entry.get("queries", ()))
    return {
        "title": f"{entry['title']} в матрице судьбы — {entry['hint']}",
        "description": entry["seo_description"],
        "queries": _dedup(queries),
    }
