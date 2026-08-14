from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

PRODUCT_ROOT = Path(__file__).resolve().parents[2]      # project/destiny-matrix
if str(PRODUCT_ROOT) not in sys.path:
    sys.path.insert(0, str(PRODUCT_ROOT))

from engine.matrix import Matrix, calculate  # noqa: E402
from engine.sections import SPEC, build  # noqa: E402

PAID_KEYS: tuple[str, ...] = tuple(key for key, _t, _l, access, _f in SPEC if access == "paid")
FREE_KEYS: tuple[str, ...] = tuple(key for key, _t, _l, access, _f in SPEC if access == "free")
SECTION_TITLES: dict[str, str] = {key: title for key, title, _l, _a, _f in SPEC}


def build_report(birth: dt.date | str, sex: str, unlocked: bool = False) -> dict:
    """Разбор по дате. Открыт он или нет решает доступ (app/access.py), а не тариф:
    у разового тарифа право привязано к матрице, у месячного — ко всем сразу."""
    m = calculate(birth, sex)
    sections = build(m, unlocked=unlocked)
    return {
        "birth": m.birth.isoformat(),
        "sex": m.sex,
        "unlocked": unlocked,
        "matrix": m.to_dict(),
        "sections": sections,
    }
