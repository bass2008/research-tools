"""Public report catalog generated from the canonical section specification.

Раньше список жил в трёх местах: engine/sections.py, lib/publicSpec.ts и эталон
golden.json. Переименование раздела чинилось в одном, ломалось в другом и роняло 28 тестов.
Теперь источник один — движок, фронт читает снимок.

    PYTHONPATH=.. python scripts/make-catalog.py
"""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

from engine.sections import DEFINITIONS  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parents[1] / "content" / "sections.json"


def main() -> None:
    # Paid details stay server-only. Free selectors are public because the browser calculates
    # those two sections locally.
    items = []
    for definition in DEFINITIONS:
        item = {key: definition[key] for key in ("key", "title", "access")}
        if definition["access"] == "free":
            item["lead"] = definition["lead"]
            item["positions"] = definition["positions"]
        items.append(item)
    OUT.write_text(json.dumps({"count": len(items), "items": items}, ensure_ascii=False, indent=1) + "\n",
                   encoding="utf-8")
    free = sum(1 for x in items if x["access"] == "free")
    print(f"каталог разделов: {len(items)}, из них бесплатных {free} → {OUT.name}")


if __name__ == "__main__":
    main()
