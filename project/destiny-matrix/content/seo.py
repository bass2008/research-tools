"""Заголовки, описания и запросы для страниц энциклопедии.

Описание страницы собирается из её собственного текста, а не из шаблона: у 231 сочетания
шаблонное описание дало бы 231 почти одинаковый сниппет, и Яндекс склеил бы страницы.
Запросы — длинный хвост из `docs/product-checks-2.md`: числовые формулировки («14 аркан в
отношениях») по рекламе не кликают, но именно их ищут в органике.

Шаблоны заголовков и запросов языкозависимы и лежат в `spec/i18n/<lang>.json`: у английского
поля другой порядок слов и другой набор служебных слов, отрезать которые по русскому списку
нельзя.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache

from .labels import DEFAULT_LANG, SPEC_DIR

TITLE_LIMIT = 70
# 165 знаков: сниппет длиннее выдача обрезает сама, и обрыв делает не она, а мы
DESC_LIMIT = 165
# короче этого описание отбрасывает приёмка контента (web/lib/content.ts)
MIN_DESC = 60


@lru_cache(maxsize=None)
def _seo_of(lang: str) -> dict:
    return json.loads((SPEC_DIR / f"{lang}.json").read_text(encoding="utf-8"))["seo"]


@lru_cache(maxsize=None)
def stop_tail(lang: str = DEFAULT_LANG) -> frozenset[str]:
    """Служебные слова: описание, оканчивающееся на них, читается как обрубок."""
    return frozenset(word.lower() for word in _seo_of(lang)["stop_tail"])


def clamp(text: str, limit: int = DESC_LIMIT, lang: str = DEFAULT_LANG) -> str:
    """Описание кончается законченной мыслью, а не многоточием посреди слова.

    Раньше строку резали по лимиту и дописывали «…»: 86 описаний сочетаний обрывались
    на полуслове («…быстрый старт и сразу же структура…»), и это видел человек в выдаче.
    """
    text = " ".join(text.split()).strip()
    if len(text) <= limit:
        return text
    head = text[:limit]
    # Обрыв по последней точке иногда оставлял огрызок: у пары 5-15 второе предложение
    # кончалось за лимитом, и описание сжималось до 41 знака — приёмка такое отбрасывает,
    # и на странице вставал шаблон. Берём самый длинный вариант, который влезает.
    variants = []
    for sep in (". ", "! ", "? "):
        if sep in head:
            variants.append(head[: head.rfind(sep) + 1].strip())
    for sep in (", ", "; ", " — "):
        idx = head.rfind(sep)
        if idx > limit * 0.5:
            variants.append(head[:idx].rstrip(" ,;:—-") + ".")
    # Обрыв по последнему пробелу оставлял описание на служебном слове: «…что мы друг другу
    # обещаем и что.» Такой вариант годится только когда других нет вовсе.
    variants.append(head.rsplit(" ", 1)[0].rstrip(" ,;:—-") + ".")
    good = [v for v in variants if len(v) >= MIN_DESC and _ends_well(v, lang)]
    if good:
        return max(good, key=len)
    # ни один разрез не кончается значимым словом: отрезаем служебные слова с конца
    return _trim_tail(max(variants or [head], key=len), lang)


def _ends_well(text: str, lang: str = DEFAULT_LANG) -> bool:
    """Последнее слово не служебное: обрыв на нём читается как огрызок фразы."""
    words = text.rstrip(".!?").split()
    return bool(words) and words[-1].strip('.,;:—-«»"').lower() not in stop_tail(lang)


def first_sentence(text: str, limit: int = DESC_LIMIT, lang: str = DEFAULT_LANG) -> str:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    out = parts[0].strip()
    for nxt in parts[1:]:
        if len(out) >= 110:
            break
        out = f"{out} {nxt.strip()}"
    return clamp(out, limit, lang)


def _dedup(items: list[str]) -> list[str]:
    seen: dict[str, None] = {}
    for it in items:
        key = it.strip().lower()
        if key and key not in seen:
            seen[key] = None
    return list(seen)


def arcanum(entry: dict, lang: str = DEFAULT_LANG) -> dict:
    tpl = _seo_of(lang)
    n, title = entry["n"], entry["title"]
    low = title.lower()
    queries = [q.format(n=n, title=title, low=low) for q in tpl["arcanum_queries"]] \
        + list(entry.get("queries", ()))
    return {
        "title": tpl["arcanum_title"].format(n=n, title=title, low=low),
        "description": clamp(entry["seo_description"], DESC_LIMIT, lang),
        "queries": _dedup(queries),
    }


def combination(a: dict, b: dict, pair: dict, lang: str = DEFAULT_LANG) -> dict:
    tpl = _seo_of(lang)
    values = {
        "a": a["n"], "b": b["n"],
        "a_title": a["title"], "b_title": b["title"],
        "a_low": a["title"].lower(), "b_low": b["title"].lower(),
    }
    return {
        "title": tpl["combination_title"].format(**values),
        # первый абзац бывает одним коротким предложением: описание короче 60 знаков
        # приёмка отбрасывает, и на странице встаёт шаблон вместо написанного текста
        "description": first_sentence(" ".join(pair["paragraphs"]), DESC_LIMIT, lang),
        "queries": _dedup([q.format(**values) for q in tpl["combination_queries"]]),
    }


def position(entry: dict, kind: str, lang: str = DEFAULT_LANG) -> dict:
    tpl = _seo_of(lang)
    base = list(entry.get("queries", ()))
    pattern = tpl["section_query"] if kind == "section" else tpl["point_query"]
    base += [pattern.format(title=entry["title"], low=entry["title"].lower())]
    return {
        "title": entry["seo_title"],
        "description": clamp(entry["seo_description"], DESC_LIMIT, lang),
        "queries": _dedup(base),
    }


def chakra(entry: dict, lang: str = DEFAULT_LANG) -> dict:
    tpl = _seo_of(lang)
    low = entry["title"].lower()
    # У сахасрары, аджны и манипуры формы «<имя> в матрице судьбы» в спросе нет вовсе — есть
    # только «чакра <имя> в матрице судьбы». Поэтому слово «чакра» стоит и в заголовке, и в
    # запросах, а страница с нулевой основной формой объявляет свою через primary_query.
    queries = [q.format(title=entry["title"], low=low, hint=entry["hint"])
               for q in tpl["chakra_queries"]] + list(entry.get("queries", ()))
    primary = str(entry.get("primary_query") or "").strip()
    if primary:
        queries = [primary] + queries
    return {
        "title": tpl["chakra_title"].format(title=entry["title"], hint=entry["hint"], low=low),
        "description": clamp(entry["seo_description"], DESC_LIMIT, lang),
        "queries": _dedup(queries),
    }


def _trim_tail(text: str, lang: str = DEFAULT_LANG) -> str:
    """Отрезать служебные слова с конца: «…потому что видят то.» → «…потому что видят»."""
    words = text.rstrip(".!?").split()
    tail = stop_tail(lang)
    while len(words) > 6 and words[-1].strip('.,;:—-«»"').lower() in tail:
        words.pop()
    return " ".join(words).rstrip(" ,;:—-") + "."
