from __future__ import annotations

from sqlalchemy.orm import Session

from . import access, notifications, printing, products, readings
from .db import begin_write
from .models import User


def grant_reading(db: Session, user: User, product: products.Product, raw: dict) -> dict:
    """Выдать разбор без оплаты: открыт, но правом без заказа.

    Право бессрочное и без `purchase_id` — по этому признаку кабинет показывает разбор открытым, но
    не купленным (`access.reading_state`). Повторная выдача того же ввода ничего не ломает: разбор
    находится по вводу, а право не задваивается.
    """
    uid = user.id
    begin_write(db)
    user = db.get(User, uid)
    row = readings.create(db, user, product, raw, limited=False)
    row.saved_via = row.saved_via or "admin"
    body = {"products": [product.code], "per_reading": True}
    fresh = not access.covering(access.granted(access.active_rights(db, user)), body, row, forever=True)
    if fresh:
        right = access.grant(db, user, body, reading_id=row.id, note="выдана админом")
        ids = notifications.grant_event(db, user, right, row)
        db.commit()
        notifications.deliver_emails(db, ids)
        printing.warm(user.id, row.id)
    else:
        db.commit()
    return {**row.item(), **access.reading_state(access.active_rights(db, user), row), "granted_now": fresh}
