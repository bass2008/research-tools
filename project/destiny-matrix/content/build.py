"""Сборка контента энциклопедии в JSON для фронта.

Запуск из корня репозитория:

    python -m content.encyclopedia.build

Заголовки, вводки и доступ разделов не дублируются в контенте — они берутся из
`engine.sections.SPEC`, иначе прайс-лист бесплатных разделов разъехался бы с движком.
"""
from __future__ import annotations

import json
from pathlib import Path

from engine.matrix import CHAKRAS as CHAKRA_ROWS, COLUMNS
from engine.sections import SPEC

from . import seo
from .data.arcana import ARCANA
from .data.chakras import CHAKRAS_TEXT
from .data.in_positions import IN_POSITIONS
from .data.pairs import PAIRS
from .data.positions import POINTS, SECTIONS_META

OUT_DIR = Path(__file__).resolve().parents[1] / "web" / "content"

SECTION_KEYS = [key for key, *_ in SPEC]
SECTION_TITLE = {key: title for key, title, *_ in SPEC}
SECTION_META_BY_KEY = {m["key"]: m for m in SECTIONS_META}
POINT_BY_KEY = {p["key"]: p for p in POINTS}
ARCANUM_BY_N = {a["n"]: a for a in ARCANA}

_ROMAN = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
          (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]


def roman(n: int) -> str:
    out = []
    for value, sign in _ROMAN:
        while n >= value:
            out.append(sign)
            n -= value
    return "".join(out)


def arcanum_href(n: int) -> str:
    return f"/encyclopedia/arcanum/{n}"


def position_href(key: str) -> str:
    return f"/encyclopedia/position/{key}"


def combination_href(a: int, b: int) -> str:
    return f"/encyclopedia/combination/{min(a, b)}-{max(a, b)}"


def chakra_href(key: str) -> str:
    return f"/encyclopedia/chakra/{key}"


def _pair(a: int, b: int) -> tuple | None:
    return PAIRS.get((min(a, b), max(a, b)))


def _arcanum_refs() -> list[dict]:
    return [{"n": a["n"], "title": a["title"], "href": arcanum_href(a["n"])} for a in ARCANA]


def build_arcana() -> list[dict]:
    out = []
    for a in sorted(ARCANA, key=lambda x: x["n"]):
        n = a["n"]
        texts = IN_POSITIONS.get(n, {})
        combos = []
        for other in range(1, 23):
            if other == n:
                continue
            pair = _pair(n, other)
            if not pair:
                continue
            combos.append({
                "with": other,
                "title": ARCANUM_BY_N[other]["title"],
                "href": combination_href(n, other),
                "short": pair[0],
            })
        out.append({
            "n": n,
            "slug": a["slug"],
            "title": a["title"],
            "roman": roman(n),
            "matrix_number": n,
            "short": a["short"],
            "keywords": list(a["keywords"]),
            "meaning": list(a["meaning"]),
            "in_positions": {k: texts[k] for k in SECTION_KEYS if k in texts},
            "position_links": [
                {"key": k, "title": SECTION_TITLE[k], "href": position_href(k)}
                for k in SECTION_KEYS if k in texts
            ],
            "plus": list(a["plus"]),
            "minus": list(a["minus"]),
            "combinations": combos,
            "seo": seo.arcanum(a),
        })
    return out


def build_combinations() -> list[dict]:
    out = []
    for (a, b), value in sorted(PAIRS.items()):
        short, *paragraphs = value
        entry = {
            "a": a,
            "b": b,
            "key": f"{a}-{b}",
            "href": combination_href(a, b),
            "title": f"{ARCANUM_BY_N[a]['title']} и {ARCANUM_BY_N[b]['title']}",
            "short": short,
            "paragraphs": list(paragraphs),
            "arcana": [
                {"n": a, "title": ARCANUM_BY_N[a]["title"], "href": arcanum_href(a)},
                {"n": b, "title": ARCANUM_BY_N[b]["title"], "href": arcanum_href(b)},
            ],
        }
        entry["seo"] = seo.combination(ARCANUM_BY_N[a], ARCANUM_BY_N[b], entry)
        out.append(entry)
    return out


def build_positions() -> list[dict]:
    points_by_section: dict[str, list[str]] = {k: [] for k in SECTION_KEYS}
    for point in POINTS:
        for key in point["sections"]:
            points_by_section.setdefault(key, []).append(point["key"])
    # обратная ссылка чакра → раздел ставится автоматически: иначе страницы чакр
    # оставались бы без входящих ссылок
    chakras_by_section: dict[str, list[dict]] = {k: [] for k in SECTION_KEYS}
    for chakra in CHAKRAS_TEXT:
        title = dict((key, name) for key, name, _hint in CHAKRA_ROWS)[chakra["key"]]
        for key in chakra["sections"]:
            chakras_by_section.setdefault(key, []).append(
                {"label": title, "href": chakra_href(chakra["key"])})

    out = []
    for key, title, lead, access, _fn in SPEC:
        meta = SECTION_META_BY_KEY[key]
        item = {
            "key": key,
            "kind": "section",
            "title": title,
            "lead": lead,
            "access": access,
            "meaning": list(meta["meaning"]),
            "reading": meta["reading"],
            "points": [{"key": p, "title": POINT_BY_KEY[p]["title"], "href": position_href(p)}
                       for p in points_by_section[key]],
            "arcana": _arcanum_refs(),
            "links": [{"label": lbl, "href": href} for lbl, href in meta.get("links", ())]
                     + chakras_by_section[key],
            "seo": seo.position({**meta, "title": title}, "section"),
        }
        out.append(item)

    for point in POINTS:
        out.append({
            "key": point["key"],
            "kind": "point",
            "title": point["title"],
            "lead": point["lead"],
            "access": "free",
            "formula": point["formula"],
            "meaning": list(point["meaning"]),
            "reading": point["reading"],
            "sections": [{"key": k, "title": SECTION_TITLE[k],
                          "href": position_href(k)} for k in point["sections"]],
            "arcana": _arcanum_refs(),
            "seo": seo.position(point, "point"),
        })
    return out


def build_chakras() -> list[dict]:
    by_key = {c["key"]: c for c in CHAKRAS_TEXT}
    order = [key for key, _t, _h in CHAKRA_ROWS]
    names = {key: name for key, name, _h in CHAKRA_ROWS}
    out = []
    for idx, (key, title, hint) in enumerate(CHAKRA_ROWS):
        data = by_key[key]
        neighbours = []
        if idx > 0:
            above = order[idx - 1]
            neighbours.append({"label": f"Выше: {names[above]}", "href": chakra_href(above)})
        if idx < len(order) - 1:
            below = order[idx + 1]
            neighbours.append({"label": f"Ниже: {names[below]}", "href": chakra_href(below)})
        out.append({
            "key": key,
            "title": title,
            "hint": hint,
            "level": data["level"],
            "number": len(order) - idx,
            "columns": [
                {"key": col_key, "title": col_title, "text": data["columns"][col_key]}
                for col_key, col_title in COLUMNS
            ],
            "sections": [{"key": k, "title": SECTION_TITLE[k],
                          "href": position_href(k)} for k in data["sections"]],
            "arcana": _arcanum_refs(),
            "links": neighbours,
            "seo": seo.chakra({**data, "title": title, "hint": hint}),
        })
    return out


def write(name: str, items: list[dict]) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    payload = {"count": len(items), "items": items}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return path


def main() -> None:
    parts = {
        "arcana.json": build_arcana(),
        "combinations.json": build_combinations(),
        "positions.json": build_positions(),
        "chakras.json": build_chakras(),
    }
    for name, items in parts.items():
        path = write(name, items)
        print(f"{name}: {len(items)} записей, {path.stat().st_size / 1024:.0f} КБ")
    pages = len(parts["arcana.json"]) + len(parts["combinations.json"]) \
        + len(parts["positions.json"]) + len(parts["chakras.json"]) + 1
    print(f"страниц энциклопедии: {pages}")


if __name__ == "__main__":
    main()
