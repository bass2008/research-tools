"""Справочник тарифов живёт в базе: цену меняем часто, для этого пересборка не нужна.

Здесь остались только чтение и начальное наполнение. Цены — в копейках.
"""
from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .access import ALL, MATRIX, SINGLE
from .models import Tariff

SINGLE_ID = "single"
MONTH_ID = "month"

# Что показываем в витрине. Подписка в справочнике осталась — механика прав под неё написана и
# проверена тестами, — но на сайт не выводится: пока продаём только разовый разбор.
PUBLIC_IDS = (SINGLE_ID,)

# Начальные цены намеренно низкие: проверяем, платят ли вообще, а не сколько.
SEED = [
    {"id": SINGLE_ID, "name": "Полный разбор одной даты", "price": 25_000,
     "scope": [SINGLE], "period_days": None},
    # Доступ на срок, а не покупка: разборы открыты, пока он активен. Поэтому за единицу
    # он дешевле разового — тот остаётся у человека навсегда.
    {"id": MONTH_ID, "name": "Три месяца без ограничений", "price": 24_000,
     "scope": [SINGLE, MATRIX, ALL], "period_days": 90},
]


def all_tariffs(db: Session) -> list[Tariff]:
    return list(db.scalars(select(Tariff).order_by(Tariff.price)))


def public_tariffs(db: Session) -> list[Tariff]:
    """Витрина: только то, что сейчас продаём."""
    return [t for t in all_tariffs(db) if t.id in PUBLIC_IDS]


def get(db: Session, tariff_id: str | None) -> Tariff | None:
    if not tariff_id:
        return None
    return db.get(Tariff, tariff_id)


def seed(db: Session, force: bool = False) -> list[Tariff]:
    """Наполнить справочник. force перезаписывает цены — на этапе экспериментов это норма."""
    for row in SEED:
        existing = db.get(Tariff, row["id"])
        if existing is None:
            db.add(Tariff(id=row["id"], name=row["name"], price=row["price"],
                          scope=json.dumps(row["scope"], ensure_ascii=False),
                          period_days=row["period_days"]))
        elif force:
            existing.name = row["name"]
            existing.price = row["price"]
            existing.scope = json.dumps(row["scope"], ensure_ascii=False)
            existing.period_days = row["period_days"]
    db.commit()
    return all_tariffs(db)
