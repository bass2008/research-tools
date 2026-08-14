"""Схема без миграций: пока идёт разработка, таблицы можно ронять и создавать заново.

    python -m app.schema ensure   создать недостающее и наполнить справочник
    python -m app.schema reset    снести всё и создать заново

Когда пойдут живые продажи, миграции надо вернуть: `reset` уносит платежи.
"""
from __future__ import annotations

import sys

from .db import Base, SessionLocal, engine
from . import models  # noqa: F401  — модели должны быть импортированы до create_all
from . import tariffs


def ensure() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        rows = tariffs.seed(db)
    print(f"схема на месте, тарифов: {len(rows)}")
    for t in rows:
        print(f"  {t.id:8s} {t.name:28s} {t.price / 100:8.2f} ₽  "
              f"{'бессрочно' if t.period_days is None else str(t.period_days) + ' дней'}  "
              f"{','.join(t.scopes())}")


def reset() -> None:
    Base.metadata.drop_all(engine)
    print("таблицы снесены")
    ensure()


if __name__ == "__main__":
    {"ensure": ensure, "reset": reset}[sys.argv[1] if len(sys.argv) > 1 else "ensure"]()
