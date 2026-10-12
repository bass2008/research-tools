"""Сохранение и чтение разборов — одинаково для любого продукта."""
from __future__ import annotations

import json

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import access, offers, products
from .config import settings
from .http_errors import LocalizedHTTPException
from .i18n import say, say_for, validation_message
from .models import Reading, User


def product_or_404(code: str | None) -> products.Product:
    product = products.get(code)
    if product is None:
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("reading.no_product"))
    return product


def normalized(product: products.Product, raw: dict) -> dict:
    try:
        return product.normalize(raw)
    except ValueError as exc:
        raise LocalizedHTTPException(status.HTTP_400_BAD_REQUEST,
                                     detail=lambda: validation_message(exc)) from exc


def find(db: Session, user: User, product: products.Product, inputs: dict) -> Reading | None:
    """Тот же ввод второй раз — тот же разбор: повторное сохранение не тратит место."""
    return db.scalars(select(Reading).where(Reading.user_id == user.id,
                                            Reading.product == product.code,
                                            Reading.subject_key == product.subject_key(inputs))
                      .order_by(Reading.id)).first()


def _no_room(db: Session, product: products.Product, used: int) -> HTTPException:
    """Места кончились: один разбор бесплатно плюс по одному за каждое купленное разовое право.

    Названия предложений берём из справочника: они живут в базе и меняются без правки кода.
    """
    single = next((o for o in offers.storefront(db, product.code) if o.per_reading), None)
    # Про «оплаченные даты» говорить нельзя: чаще всего человек ещё ничего не покупал, и такой
    # текст читается как отказ в том, за что он уже заплатил.
    return LocalizedHTTPException(
        status.HTTP_402_PAYMENT_REQUIRED,
        detail=lambda: say("matrix.no_slots", used=used,
                           offer=say("matrix.slots_offer", name=single.public_body()["name"]) if single else ""),
    )


def create(db: Session, user: User, product: products.Product, raw: dict,
           title: str | None = None, *, limited: bool = True) -> Reading:
    """Сохранить разбор или вернуть уже сохранённый с тем же вводом.

    `limited=False` — сохранение ради оплаты или выдачи админом: место под оплаченный разбор
    появляется вместе с правом, и отказывать в нём нельзя.
    """
    inputs = normalized(product, raw)
    row = find(db, user, product, inputs)
    if row is not None:
        return row
    used = access.saved_count(db, user)
    if used >= settings.matrices_hard_cap:
        raise LocalizedHTTPException(status.HTTP_402_PAYMENT_REQUIRED,
                                     detail=lambda: say("matrix.hard_cap", cap=settings.matrices_hard_cap))
    if limited and not access.can_save_more(db, user, product.code):
        raise _no_room(db, product, access.saved_count(db, user, product.code))
    row = Reading(user_id=user.id, product=product.code,
                  inputs=json.dumps(inputs, ensure_ascii=False),
                  subject_key=product.subject_key(inputs), title=(title or None))
    db.add(row)
    db.flush()
    return row


def own(db: Session, user: User, reading_id: int, product: str | None = None) -> Reading:
    row = db.get(Reading, reading_id)
    # чужой разбор отдаёт 404, а не 403: существование чужих записей знать незачем
    if row is None or row.user_id != user.id or (product and row.product != product):
        named = product or (row.product if row is not None and row.user_id == user.id else "pair")
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say_for("matrix.not_found", named))
    return row


def card(db: Session, user: User, row: Reading) -> dict:
    """Карточка разбора: ввод, подпись и права. Толкований здесь нет — разбор считает фронт."""
    rights = access.active_rights(db, user)
    return {**row.item(), **access.reading_state(rights, row),
            "unlocked": access.can_open(db, user, row, rights=rights),
            "plan": access.plan_label(db, rights, row)}
