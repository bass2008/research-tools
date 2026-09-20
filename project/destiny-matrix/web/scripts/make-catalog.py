"""Public report catalog generated from the canonical section specification.

Раньше список жил в трёх местах: engine/sections.py, lib/publicSpec.ts и эталон
golden.json. Переименование раздела чинилось в одном, ломалось в другом и роняло 28 тестов.
Теперь источник один — движок, фронт читает снимок.

    PYTHONPATH=.. python scripts/make-catalog.py             # русский
    PYTHONPATH=.. python scripts/make-catalog.py --lang en   # английский

Состав, порядок и доступ разделов берутся из движка, слова — из `spec/i18n/<lang>.json`.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

from content.labels import DEFAULT_LANG, labels  # noqa: E402
from engine.sections import DEFINITIONS  # noqa: E402

CONTENT = pathlib.Path(__file__).resolve().parents[1] / "content"


def catalog(lang: str) -> list[dict]:
    text = labels(lang)
    # Paid details stay server-only. Free selectors are public because the browser calculates
    # those two sections locally.
    items = []
    for definition in DEFINITIONS:
        key = definition["key"]
        item = {"key": key, "title": text.section_title(key), "access": definition["access"]}
        if definition["access"] == "free":
            item["lead"] = text.section_lead(key)
            item["positions"] = [
                {**position, "label": text.position_label(key, index)}
                if "label" in position else dict(position)
                for index, position in enumerate(definition["positions"])
            ]
        items.append(item)
    return items


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", default=DEFAULT_LANG, help="язык подписей (ru, en)")
    args = parser.parse_args()

    items = catalog(args.lang)
    out = CONTENT / args.lang / "sections.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"count": len(items), "items": items}, ensure_ascii=False, indent=1) + "\n",
                   encoding="utf-8")
    free = sum(1 for x in items if x["access"] == "free")
    print(f"[{args.lang}] каталог разделов: {len(items)}, из них бесплатных {free} → {out}")


if __name__ == "__main__":
    main()
