"""Заголовки, описания и запросы для страниц энциклопедии.

Описание страницы собирается из её собственного текста, а не из шаблона: у 231 сочетания
шаблонное описание дало бы 231 почти одинаковый сниппет, и Яндекс склеил бы страницы.
Запросы — длинный хвост из `docs/product-checks-2.md`: числовые формулировки («14 аркан в
отношениях») по рекламе не кликают, но именно их ищут в органике.
"""
from __future__ import annotations

import re

TITLE_LIMIT = 70
# 165 знаков: сниппет длиннее выдача обрезает сама, и обрыв делает не она, а мы
DESC_LIMIT = 165
# короче этого описание отбрасывает приёмка контента (web/lib/content.ts)
MIN_DESC = 60
# служебные слова: описание, оканчивающееся на них, читается как обрубок
STOP_TAIL = {
    "и", "а", "но", "или", "что", "чтобы", "как", "когда", "если", "потому", "поэтому", "то",
    "же", "ли", "бы", "в", "во", "на", "за", "по", "под", "над", "от", "до", "из", "к", "ко",
    "с", "со", "у", "о", "об", "про", "для", "без", "при", "через", "не", "ни", "это", "этот",
    "эта", "тот", "та", "то", "те", "их", "его", "её", "свой", "своя", "своё", "там", "тут",
    "уже", "ещё", "весь", "вся", "всё",
}


def clamp(text: str, limit: int = DESC_LIMIT) -> str:
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
    good = [v for v in variants if len(v) >= MIN_DESC and _ends_well(v)]
    if good:
        return max(good, key=len)
    # ни один разрез не кончается значимым словом: отрезаем служебные слова с конца
    return _trim_tail(max(variants or [head], key=len))


def _ends_well(text: str) -> bool:
    """Последнее слово не служебное: обрыв на нём читается как огрызок фразы."""
    words = text.rstrip(".!?").split()
    return bool(words) and words[-1].strip('.,;:—-«»"').lower() not in STOP_TAIL


def first_sentence(text: str, limit: int = DESC_LIMIT) -> str:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    out = parts[0].strip()
    for nxt in parts[1:]:
        if len(out) >= 110:
            break
        out = f"{out} {nxt.strip()}"
    return clamp(out, limit)


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
        "description": clamp(entry["seo_description"]),
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
        # первый абзац бывает одним коротким предложением: описание короче 60 знаков
        # приёмка отбрасывает, и на странице встаёт шаблон вместо написанного текста
        "description": first_sentence(" ".join(pair["paragraphs"]), DESC_LIMIT),
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
        "description": clamp(entry["seo_description"]),
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
        "description": clamp(entry["seo_description"]),
        "queries": _dedup(queries),
    }


def _trim_tail(text: str) -> str:
    """Отрезать служебные слова с конца: «…потому что видят то.» → «…потому что видят»."""
    words = text.rstrip(".!?").split()
    while len(words) > 6 and words[-1].strip('.,;:—-«»"').lower() in STOP_TAIL:
        words.pop()
    return " ".join(words).rstrip(" ,;:—-") + "."
