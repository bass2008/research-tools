#!/usr/bin/env python
"""Снять эталон паритета движков: lib/__fixtures__/golden.json из engine/*.py.

    conda run -n research3.12 python scripts/make-golden.py

Даты берутся из текущего эталона, чтобы покрытие не менялось само (29 февраля, 1900 год,
оба пола). Пересобирать после любой правки формул или состава разделов.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WEB.parent))

from engine.matrix import calculate  # noqa: E402
from engine.sections import build  # noqa: E402

FIXTURE = WEB / "lib" / "__fixtures__" / "golden.json"


def section_rows(matrix, unlocked: bool) -> list[dict]:
    # build отдаёт уже словари в форме контракта — оставляем как есть
    return build(matrix, unlocked=unlocked)


def main() -> None:
    cases = json.loads(FIXTURE.read_text())
    fresh = []
    for case in cases:
        m = calculate(case["birth"], case["sex"])
        fresh.append({
            "birth": case["birth"],
            "sex": case["sex"],
            "matrix": m.to_dict(),
            "sections_locked": section_rows(m, False),
            "sections_unlocked": section_rows(m, True),
        })
    FIXTURE.write_text(json.dumps(fresh, ensure_ascii=False, indent=2) + "\n")
    free = sum(1 for s in fresh[0]["sections_locked"] if s["access"] == "free")
    print(f"эталон обновлён: {len(fresh)} дат, разделов {len(fresh[0]['sections_locked'])}, "
          f"бесплатных {free}")


if __name__ == "__main__":
    main()
