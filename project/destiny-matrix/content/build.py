"""Сборка контента энциклопедии в JSON для фронта.

Запуск из корня репозитория:

    python -m content.build            # русский корпус
    python -m content.build --lang en  # английский

Порядок и доступ разделов берутся из `engine.sections.SPEC` — иначе прайс-лист бесплатных
разделов разъехался бы с движком. Слова (заголовки, вводки, подписи позиций) приходят из
`spec/i18n/<lang>.json`: контракт один на все языки, текст у каждого свой.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, fields
from pathlib import Path

from engine.matrix import CHAKRAS as CHAKRA_ROWS, COLUMNS, Matrix
from engine.sections import SPEC

from . import seo
from .labels import DEFAULT_LANG, Labels, labels
from .source import Corpus, corpus

OUT_ROOT = Path(__file__).resolve().parents[1] / "web" / "content"

SECTION_KEYS = [key for key, *_ in SPEC]
SECTION_ACCESS = {key: access for key, _title, _lead, access, *_ in SPEC}


def out_dir(lang: str = DEFAULT_LANG) -> Path:
    """Корпус лежит по каталогам языка; `matrices.json` общий и остаётся уровнем выше."""
    return OUT_ROOT / lang


@dataclass(frozen=True)
class Ctx:
    """Всё, что нужно сборке одного языка: исходный корпус и подписи метода."""

    lang: str
    src: Corpus
    text: Labels

    @property
    def point_keys(self) -> list[str]:
        return [point["key"] for point in self.src.points]

    @property
    def in_position_keys(self) -> list[str]:
        return SECTION_KEYS + self.point_keys

    @property
    def section_meta(self) -> dict[str, dict]:
        return {row["key"]: row for row in self.src.sections}

    @property
    def point_by_key(self) -> dict[str, dict]:
        return {row["key"]: row for row in self.src.points}

    @property
    def arcanum_by_n(self) -> dict[int, dict]:
        return {row["n"]: row for row in self.src.arcana}


def context(lang: str = DEFAULT_LANG) -> Ctx:
    return Ctx(lang=lang, src=corpus(lang), text=labels(lang))


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


def _pair(ctx: Ctx, a: int, b: int) -> tuple | None:
    return ctx.src.pairs.get((min(a, b), max(a, b)))


def _arcanum_refs(ctx: Ctx) -> list[dict]:
    return [{"n": a["n"], "title": a["title"], "href": arcanum_href(a["n"])}
            for a in ctx.src.arcana]


def build_arcana(ctx: Ctx) -> list[dict]:
    out = []
    arcanum_by_n = ctx.arcanum_by_n
    keys = ctx.in_position_keys
    for a in sorted(ctx.src.arcana, key=lambda x: x["n"]):
        n = a["n"]
        texts = ctx.src.in_positions.get(n, {})
        combos = []
        for other in range(1, 23):
            if other == n:
                continue
            pair = _pair(ctx, n, other)
            if not pair:
                continue
            combos.append({
                "with": other,
                "title": arcanum_by_n[other]["title"],
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
            "in_positions": {k: texts[k] for k in keys if k in texts},
            "position_links": [
                {"key": k, "title": ctx.text.section_title(k), "href": position_href(k)}
                for k in SECTION_KEYS if k in texts
            ],
            "plus": list(a["plus"]),
            "minus": list(a["minus"]),
            "repeat": a["repeat"],
            "combinations": combos,
            "seo": seo.arcanum(a, ctx.lang),
        })
    return out


def build_combinations(ctx: Ctx) -> list[dict]:
    out = []
    arcanum_by_n = ctx.arcanum_by_n
    joiner = " и " if ctx.lang == "ru" else " and "
    for (a, b), value in sorted(ctx.src.pairs.items()):
        short, *paragraphs = value
        entry = {
            "a": a,
            "b": b,
            "key": f"{a}-{b}",
            "href": combination_href(a, b),
            "title": f"{arcanum_by_n[a]['title']}{joiner}{arcanum_by_n[b]['title']}",
            "short": short,
            "paragraphs": list(paragraphs),
            "arcana": [
                {"n": a, "title": arcanum_by_n[a]["title"], "href": arcanum_href(a)},
                {"n": b, "title": arcanum_by_n[b]["title"], "href": arcanum_href(b)},
            ],
        }
        entry["seo"] = seo.combination(arcanum_by_n[a], arcanum_by_n[b], entry, ctx.lang)
        out.append(entry)
    return out


def build_positions(ctx: Ctx) -> list[dict]:
    points_by_section: dict[str, list[str]] = {k: [] for k in SECTION_KEYS}
    for point in ctx.src.points:
        for key in point["sections"]:
            points_by_section.setdefault(key, []).append(point["key"])
    # обратная ссылка чакра → раздел ставится автоматически: иначе страницы чакр
    # оставались бы без входящих ссылок
    chakras_by_section: dict[str, list[dict]] = {k: [] for k in SECTION_KEYS}
    for chakra in ctx.src.chakras:
        title = ctx.text.chakra_title(chakra["key"])
        for key in chakra["sections"]:
            chakras_by_section.setdefault(key, []).append(
                {"label": title, "href": chakra_href(chakra["key"])})

    section_meta = ctx.section_meta
    point_by_key = ctx.point_by_key
    out = []
    for key in SECTION_KEYS:
        meta = section_meta[key]
        title = ctx.text.section_title(key)
        item = {
            "key": key,
            "kind": "section",
            "title": title,
            "lead": ctx.text.section_lead(key),
            "access": SECTION_ACCESS[key],
            "formula": meta["formula"],
            "meaning": list(meta["meaning"]),
            "reading": meta["reading"],
            "points": [{"key": p, "title": point_by_key[p]["title"], "href": position_href(p)}
                       for p in points_by_section[key]],
            "arcana": _arcanum_refs(ctx),
            "links": [{"label": lbl, "href": href} for lbl, href in meta.get("links", ())]
                     + chakras_by_section[key],
            "seo": seo.position({**meta, "title": title}, "section", ctx.lang),
        }
        # Полноценные статьи нужны не каждому служебному разделу. Не подставляем пустой
        # шаблон: дополнительные главы и FAQ публикуются только когда написаны в источнике.
        if meta.get("article_sections"):
            item["article_sections"] = list(meta["article_sections"])
        if meta.get("faq"):
            item["faq"] = list(meta["faq"])
        out.append(item)

    for point in ctx.src.points:
        item = {
            "key": point["key"],
            "kind": "point",
            "title": point["title"],
            "lead": point["lead"],
            "access": "free",
            "formula": point["formula"],
            "meaning": list(point["meaning"]),
            "reading": point["reading"],
            "sections": [{"key": k, "title": ctx.text.section_title(k),
                          "href": position_href(k)} for k in point["sections"]],
            "arcana": _arcanum_refs(ctx),
            "seo": seo.position(point, "point", ctx.lang),
        }
        if point.get("article_sections"):
            item["article_sections"] = list(point["article_sections"])
        if point.get("faq"):
            item["faq"] = list(point["faq"])
        out.append(item)
    return out


def build_chakras(ctx: Ctx) -> list[dict]:
    by_key = {c["key"]: c for c in ctx.src.chakras}
    order = [key for key, _t, _h in CHAKRA_ROWS]
    above_label, below_label = ("Выше", "Ниже") if ctx.lang == "ru" else ("Above", "Below")
    out = []
    for idx, key in enumerate(order):
        data = by_key[key]
        title = ctx.text.chakra_title(key)
        hint = ctx.text.chakra_hint(key)
        neighbours = []
        if idx > 0:
            above = order[idx - 1]
            neighbours.append({"label": f"{above_label}: {ctx.text.chakra_title(above)}",
                               "href": chakra_href(above)})
        if idx < len(order) - 1:
            below = order[idx + 1]
            neighbours.append({"label": f"{below_label}: {ctx.text.chakra_title(below)}",
                               "href": chakra_href(below)})
        out.append({
            "key": key,
            "title": title,
            "hint": hint,
            "level": data["level"],
            "number": len(order) - idx,
            "columns": [
                {"key": col_key, "title": ctx.text.column_title(col_key),
                 "text": data["columns"][col_key]}
                for col_key, _col_title in COLUMNS
            ],
            "sections": [{"key": k, "title": ctx.text.section_title(k),
                          "href": position_href(k)} for k in data["sections"]],
            "arcana": _arcanum_refs(ctx),
            "links": neighbours,
            "seo": seo.chakra({**data, "title": title, "hint": hint}, ctx.lang),
        })
    return out


def write(lang: str, name: str, items: list[dict]) -> Path:
    directory = out_dir(lang)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / name
    payload = {"count": len(items), "items": items}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return path


def build_arcana_catalog(items: list[dict]) -> list[dict]:
    """Small client-safe catalog: no article bodies or paid position interpretations."""
    return [
        {"n": item["n"], "slug": item["slug"], "title": item["title"], "short": item["short"]}
        for item in items
    ]


def build_point_catalog(ctx: Ctx) -> list[dict]:
    """Small client-safe point catalog generated from the canonical point metadata.

    Таблица «Все позиции карты» читает матрицу по ключу, поэтому в каталог идут только точки,
    которые лежат в расчёте отдельным числом. Партнёрская точка R1 живёт внутри линии отношений
    и своего поля не имеет: страница в энциклопедии у неё есть, строки в таблице — нет.
    """
    scalar = {field.name for field in fields(Matrix) if field.default == 0}
    return [{"key": point["key"], "report_label": point["report_label"]}
            for point in ctx.src.points if point["key"] in scalar]


def write_raw(lang: str, name: str, payload: dict) -> Path:
    directory = out_dir(lang)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return path


def build_all(lang: str = DEFAULT_LANG) -> dict[str, list[dict]]:
    ctx = context(lang)
    parts = {
        "arcana.json": build_arcana(ctx),
        "combinations.json": build_combinations(ctx),
        "positions.json": build_positions(ctx),
        "chakras.json": build_chakras(ctx),
    }
    for name, items in parts.items():
        path = write(lang, name, items)
        print(f"[{lang}] {name}: {len(items)} записей, {path.stat().st_size / 1024:.0f} КБ")
    catalog = build_arcana_catalog(parts["arcana.json"])
    path = write(lang, "arcana-catalog.json", catalog)
    print(f"[{lang}] arcana-catalog.json: {len(catalog)} записей, "
          f"{path.stat().st_size / 1024:.0f} КБ")
    point_catalog = build_point_catalog(ctx)
    path = write(lang, "points-catalog.json", point_catalog)
    print(f"[{lang}] points-catalog.json: {len(point_catalog)} записей, "
          f"{path.stat().st_size / 1024:.0f} КБ")
    path = write_raw(lang, "text-policy.json", ctx.src.text_policy)
    print(f"[{lang}] text-policy.json: {path.stat().st_size / 1024:.0f} КБ")
    pages = sum(len(items) for items in parts.values()) + 1
    print(f"[{lang}] страниц энциклопедии: {pages}")
    return parts


def main() -> None:
    parser = argparse.ArgumentParser(description="Сборка корпуса энциклопедии для одного языка")
    parser.add_argument("--lang", default=DEFAULT_LANG, help="язык корпуса (ru, en)")
    args = parser.parse_args()
    build_all(args.lang)


if __name__ == "__main__":
    main()
