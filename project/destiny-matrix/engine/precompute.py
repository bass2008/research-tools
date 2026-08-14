"""Предвычисление всех возможных матриц — для статической генерации страниц.

Матрица зависит не от даты, а от тройки (день, месяц, год) после свёртки, поэтому 46 021
реальная дата рождения даёт всего 5 544 различных матрицы: 22 x 12 x 21. Их можно
сгенерировать заранее и раздавать статикой.

Контент при этом писать на каждую матрицу не нужно: 20 разделов x 22 аркана = 440 текстов
плюс 231 сочетание, 22 аркана и 7 чакр — 700 текстов покрывают все 5 544 матрицы.

    conda run -n research3.12 python -m engine.precompute --out apps/web/content/matrices.json
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
from pathlib import Path

from .matrix import calculate, fold, fold_year
from .sections import build, referenced_arcana


def all_keys() -> list[tuple[int, int, int]]:
    """Все тройки, достижимые реальными датами рождения с 1900 года."""
    seen: dict[tuple[int, int, int], None] = {}
    for year in range(1900, _dt.date.today().year + 1):
        c = fold_year(year)
        for month in range(1, 13):
            b = fold(month)
            for day in range(1, 32):
                try:
                    _dt.date(year, month, day)
                except ValueError:
                    continue
                seen.setdefault((fold(day), b, c), None)
    return sorted(seen)


def sample_date(key: tuple[int, int, int]) -> _dt.date:
    """Любая дата, дающая эту тройку — нужна, чтобы посчитать матрицу через calculate."""
    a, b, c = key
    for year in range(1900, _dt.date.today().year + 1):
        if fold_year(year) != c:
            continue
        for day in (a, a + 22):
            try:
                d = _dt.date(year, b, day)
            except ValueError:
                continue
            if (fold(d.day), fold(d.month), fold_year(d.year)) == key:
                return d
    raise LookupError(f"нет даты для тройки {key}")


def slug(key: tuple[int, int, int]) -> str:
    return "-".join(str(x) for x in key)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--with-sections", action="store_true",
                    help="вложить разделы целиком: файл вырастет примерно до 40 МБ")
    args = ap.parse_args()

    keys = all_keys()
    items = []
    for key in keys:
        d = sample_date(key)
        m = calculate(d)
        item = {"slug": slug(key), "day": key[0], "month": key[1], "year": key[2],
                "matrix": m.to_dict(), "arcana": referenced_arcana(m)}
        if args.with_sections:
            item["sections"] = build(m, unlocked=True)
        items.append(item)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({"count": len(items), "items": items},
                                   ensure_ascii=False), encoding="utf-8")
    size = args.out.stat().st_size / 2**20
    print(f"матриц: {len(items)}, файл {args.out} — {size:.1f} МБ")


if __name__ == "__main__":
    main()
