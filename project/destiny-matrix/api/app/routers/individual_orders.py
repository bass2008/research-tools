from __future__ import annotations

import json

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import individual_orders as orders, offers, payments, sites
from ..config import settings
from ..db import get_db
from ..deps import optional_user
from ..http_errors import LocalizedHTTPException
from ..i18n import current_locale, say
from ..models import Purchase, User, as_utc, utcnow
from . import payments as pay

router = APIRouter(prefix="/individual-orders", tags=["individual-orders"])


@router.get("/terms")
def terms(user: User | None = Depends(optional_user), db: Session = Depends(get_db)) -> dict:
    """Prices for this person: from three readings bought on, any reading costs 1 190."""
    return orders.terms(db, user)


def _open_order(db: Session, user: User, fingerprint: str, amount: int, connection: sites.Connection) -> Purchase | None:
    """The same unpaid order from the same page: a second tab or click returns to it instead of a
    second order — as with automatic readings."""
    rows = db.scalars(select(Purchase).where(Purchase.user_id == user.id, Purchase.offer_id == orders.OFFER_ID,
                                             Purchase.paid_at.is_(None), Purchase.refunded_at.is_(None))
                      .order_by(Purchase.id.desc()).limit(5)).all()
    for row in rows:
        body, attempt = row.body(), row.last_payment()
        if (body.get("fingerprint") != fingerprint or row.amount != amount or attempt is None
                or sites.payment_connection(attempt) != connection or sites.payment_site(attempt) != sites.current()
                or body.get("locale", "ru") != current_locale()):
            continue
        if (utcnow() - as_utc(row.created_at)).total_seconds() > settings.payment_reuse_seconds:
            continue
        return row
    return None


def _start(db: Session, payload: orders.OrderIn, connection: sites.Connection) -> dict:
    """Same path as any purchase — buyer, order, attempt, provider, apply() — with the price
    counted from the order instead of taken from the offer."""
    if settings.all_free_without_payment:
        raise LocalizedHTTPException(status.HTTP_409_CONFLICT, detail=lambda: say("pay.all_free"))
    site = sites.current()
    provider = payments.get(connection.provider)
    offer = offers.get(db, orders.OFFER_ID)
    if offer is None or offer.channel != offers.channel():
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("pay.no_tariff"))
    user, autoregistered = pay._buyer(db, payload.email)
    order = orders.order_of(payload)
    amount = orders.price(order["cart"], orders.bought(db, user.id), orders.price_list(db)) * 100
    name = orders.title(order["cart"], current_locale())
    fingerprint = orders.fingerprint(order)
    purchase = _open_order(db, user, fingerprint, amount, connection)
    if purchase is not None:
        live = pay._reusable(db, purchase, provider)
        if live is not None:
            db.commit()
            return {**pay._body(db, live, user, None, offer, live.order_id or "", autoregistered),
                    "individual": True, "amount": purchase.amount}
    else:
        body = {**offer.body(), "kind": orders.OFFER_ID, "name": name, "display_name": name, "price": amount,
                "per_reading": False, "order": order, "fingerprint": fingerprint, "locale": current_locale(),
                "site_origin": site.origin, "connection_id": connection.id}
        purchase = Purchase(user_id=user.id, offer_id=offer.id, offer_body=json.dumps(body, ensure_ascii=False),
                            reading_id=None, amount=amount, currency=offer.currency, channel=offer.channel)
        db.add(purchase)
        db.flush()
    payment = pay.begin_attempt(db, purchase, user, provider, connection)
    db.refresh(user)
    return {**pay._body(db, payment, user, None, offer, payment.order_id or "", autoregistered), "individual": True,
            "amount": amount}


@router.post("/start")
def start(payload: orders.OrderIn, db: Session = Depends(get_db)) -> dict:
    return _start(db, payload, payments.select_connection(payload.provider))


@router.post("/mock")
def start_mock(payload: orders.OrderIn, db: Session = Depends(get_db)) -> dict:
    """Payment without money for the stand and tests: the same path with the mock provider."""
    connection = payments.select_connection(payload.provider or "mock")
    if connection.provider != "mock":
        raise LocalizedHTTPException(status.HTTP_403_FORBIDDEN, detail=lambda: say("pay.mock_off"))
    return {**_start(db, payload, connection), "mock": True}
