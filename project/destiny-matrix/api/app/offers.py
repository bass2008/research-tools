"""Справочник предложений живёт в базе: цену меняем часто, для этого пересборка не нужна.

Здесь только чтение и начальное наполнение. Цены — в копейках.
"""
from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Offer
from .products import ANY, PAIR, PERSONAL

SINGLE_ID = "single"
MONTH_ID = "month"
PAIR_ID = "pair"

SITE = "site"

# Цены с 24.10.2026; существующие базы обновляет миграция 006.
SEED = [
    {"id": SINGLE_ID, "name": "Полный разбор одной даты", "price": 39_000,
     "products": [PERSONAL], "per_reading": True, "store_unlimited": False,
     "period_days": None, "public": True, "sort": 10},
    {"id": PAIR_ID, "name": "Совместимость пары", "price": 39_000,
     "products": [PAIR], "per_reading": True, "store_unlimited": False,
     "period_days": None, "public": True, "sort": 20},
    {"id": MONTH_ID, "name": "Подписка на 3 месяца", "price": 59_000,
     "products": [ANY], "per_reading": False, "store_unlimited": True,
     "period_days": 90, "public": True, "sort": 30},
]


def channel() -> str:
    """Канал запроса. Пока он один — сайт; лендинг получит свой по адресу или профилю домена."""
    return SITE


def all_offers(db: Session) -> list[Offer]:
    return list(db.scalars(select(Offer).order_by(Offer.sort, Offer.price)))


def storefront(db: Session, product: str | None = None) -> list[Offer]:
    """Витрина канала запроса: что сейчас продаём, при желании — только для одного продукта."""
    out = [o for o in all_offers(db)
           if o.public and o.channel == channel()]
    if product:
        out = [o for o in out if ANY in o.product_list() or product in o.product_list()]
    return out


def get(db: Session, offer_id: str | None) -> Offer | None:
    if not offer_id:
        return None
    return db.get(Offer, offer_id)


def seed(db: Session, force: bool = False) -> list[Offer]:
    """Наполнить справочник. force перезаписывает цены — на этапе экспериментов это норма."""
    for row in SEED:
        existing = db.get(Offer, row["id"])
        values = {**row, "products": json.dumps(row["products"], ensure_ascii=False)}
        if existing is None:
            db.add(Offer(**values))
        elif force:
            for key, value in values.items():
                setattr(existing, key, value)
    db.commit()
    return all_offers(db)


def display_name(offer_id: str, stored_name: str) -> str:
    """Translate the built-in labels; preserve names explicitly edited by the owner."""
    from .i18n import current_locale
    labels = {
        SINGLE_ID: {"ru": "Полный разбор одной даты", "en": "Full reading for one date"},
        MONTH_ID: {"ru": "Подписка на 3 месяца", "en": "3-month subscription"},
        PAIR_ID: {"ru": "Совместимость пары", "en": "Couple compatibility"},
    }
    translated = labels.get(offer_id, {})
    return translated.get(current_locale(), stored_name) if stored_name in translated.values() else stored_name
