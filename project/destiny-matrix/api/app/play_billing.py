"""Native purchase ledger, shared by verification, restore, RTDN and reconciliation."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import access, products, readings, notifications, sites
from .i18n import current_locale, using_locale
from .config import settings
from .db import begin_write
from .http_errors import error
from .models import Entitlement, Payment, PlayOrder, PlayPurchase, Purchase, User, as_utc, iso, utcnow
from .payments import google_play as google

PRODUCTS = {"single": "personal", "pair": "pair", "month": "*"}


def provider() -> str | None:
    return "mock" if google.mock_enabled() else "google_play" if google.enabled() else None


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def order_body(order: PlayOrder) -> dict:
    return {"order_id": order.id, "product_id": order.product_id, "provider": order.provider,
            "obfuscated_account_id": order.account_id, "obfuscated_profile_id": order.id,
            "reading_id": order.purchase.reading_id}


def create_order(db: Session, user: User, sku: str, reading_id: int | None, inputs: dict | None) -> dict:
    mode = provider()
    if mode is None:
        raise error(503, "Покупки Google Play пока недоступны.", "Google Play purchases are not available yet.")
    if sku not in PRODUCTS:
        raise error(400, "Неизвестный товар.", "Unknown product.")
    uid = user.id
    begin_write(db)
    user = db.get(User, uid, populate_existing=True)
    if user.deletion_requested_at or user.deleted_at:
        raise error(403, "Аккаунт ожидает удаления.", "The account is scheduled for deletion.")
    row = None
    if sku != "month":
        product = products.get(PRODUCTS[sku])
        row = readings.own(db, user, reading_id, product.code) if reading_id else readings.create(
            db, user, product, inputs or {}, limited=False)
    elif reading_id is not None or inputs:
        raise error(400, "Подписка не привязана к одной дате.", "A subscription is not tied to one date.")
    body = {"id": sku, "name": sku, "products": [PRODUCTS[sku]], "per_reading": sku != "month",
            "store_unlimited": sku == "month", "channel": "google_play", "currency": "EUR",
            "period_days": None, "auto_renewing": sku == "month", "amount_confirmed": mode == "mock",
            "site_origin": sites.current().origin, "locale": current_locale()}
    if access.covering(access.active_rights(db, user), body, row):
        raise error(409, "Этот доступ уже открыт.", "This access is already available.")
    # Retry of the same checkout reuses its immutable subject; two different dates get distinct profiles.
    existing = db.scalars(select(PlayOrder).join(Purchase).where(PlayOrder.user_id == uid,
        PlayOrder.product_id == sku, PlayOrder.provider == mode, Purchase.paid_at.is_(None),
        Purchase.reading_id == (row.id if row else None)).order_by(PlayOrder.created_at.desc())).first()
    if existing:
        receipt = db.scalar(select(PlayPurchase).where(PlayPurchase.order_id == existing.id))
        if receipt is None or receipt.state == "pending":
            db.commit()
            return order_body(existing)
    # Real prices come from Play; zero here means unconfirmed, never a fabricated RUB conversion.
    amount = (800 if sku == "month" else 500) if mode == "mock" else 0
    purchase = Purchase(user_id=uid, offer_id=sku, offer_body=json.dumps(body),
                        reading_id=row.id if row else None, amount=amount, currency="EUR", channel="google_play")
    db.add(purchase); db.flush()
    order = PlayOrder(id=secrets.token_hex(24), user_id=uid, purchase_id=purchase.id,
                      product_id=sku, provider=mode,
                      account_id=hmac.new(settings.jwt_secret.encode(), f"google:{uid}".encode(), hashlib.sha256).hexdigest())
    db.add(order); db.commit()
    return order_body(order)


def mock_state(receipt: PlayPurchase) -> google.State:
    data = json.loads(receipt.mock_snapshot or "{}")
    expiry = dt.datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None
    return google.State(data.get("state", "pending"), receipt.order.account_id, receipt.order.id,
                        expires_at=as_utc(expiry) if expiry else None,
                        auto_renewing=bool(data.get("auto_renewing")), finalized=receipt.finalized)


def result(db: Session, receipt: PlayPurchase) -> dict:
    order = receipt.order
    right = db.scalar(select(Entitlement).where(Entitlement.purchase_id == order.purchase_id))
    user = db.get(User, order.user_id)
    return {"order_id": order.id, "reading_id": order.purchase.reading_id, "product_id": order.product_id,
            "state": receipt.state, "access": bool(right and right.active() and not user.deletion_requested_at and not user.deleted_at),
            "expires_at": iso(receipt.expires_at), "auto_renewing": receipt.auto_renewing,
            "finalized": receipt.finalized}


def apply_state(db: Session, receipt: PlayPurchase, state: google.State) -> list[int]:
    order, now = receipt.order, utcnow()
    user = db.get(User, order.user_id)
    right = db.scalar(select(Entitlement).where(Entitlement.purchase_id == order.purchase_id))
    first_grant = right is None
    entitled = state.access and not user.deleted_at and not order.purchase.refunded_at
    if entitled:
        if right is None:
            right = Entitlement(user_id=order.user_id, purchase_id=order.purchase_id,
                products=json.dumps([PRODUCTS[order.product_id]]), per_reading=order.product_id != "month",
                store_unlimited=order.product_id == "month", reading_id=order.purchase.reading_id,
                starts_at=now, expires_at=state.expires_at, note="Google Play")
            db.add(right)
        else:
            right.revoked_at, right.expires_at = None, state.expires_at
        order.purchase.paid_at = order.purchase.paid_at or now
    elif right is not None:
        right.revoked_at = right.revoked_at or now
    if state.state == "refunded":
        order.purchase.refunded_at = order.purchase.refunded_at or now
    receipt.state, receipt.expires_at = ("refunded" if order.purchase.refunded_at else state.state), state.expires_at
    receipt.auto_renewing, receipt.checked_at = state.auto_renewing, now
    receipt.finalized = receipt.finalized or state.finalized
    payment = db.scalar(select(Payment).where(Payment.purchase_id == order.purchase_id))
    if payment is None:
        payment = Payment(user_id=order.user_id, purchase_id=order.purchase_id, amount=order.purchase.amount,
                          provider="google_play", external_id="gp-" + receipt.token_hash[:60], order_id=order.id)
        db.add(payment)
    payment.status = state.state.upper()
    payment.paid_at, payment.refunded_at = order.purchase.paid_at, order.purchase.refunded_at
    # A replacement token may only retire the same Arcana account's previous subscription.
    if state.linked_token:
        old = db.scalar(select(PlayPurchase).where(PlayPurchase.token_hash == token_hash(state.linked_token)))
        if old and old.id != receipt.id:
            if old.order.user_id != order.user_id:
                raise error(409, "Покупка связана с другим аккаунтом.", "The purchase belongs to another account.")
            previous = db.scalar(select(Entitlement).where(Entitlement.purchase_id == old.order.purchase_id))
            if previous:
                previous.revoked_at = now
            old.state, old.auto_renewing = "replaced", False
    if user.deletion_requested_at and order.product_id == "month" and state.auto_renewing:
        receipt.cancellation_pending = True
    db.flush()
    if entitled and first_grant and not user.deletion_requested_at:
        body = order.purchase.body()
        site = sites.find(body.get("site_origin"))
        if site:
            with sites.using_site(site), using_locale(body.get("locale", "ru")):
                return notifications.grant_event(db, user, right, order.purchase.reading,
                    paid=True, payment_id=payment.id, extra={"google_play": True, "auto_renewing": state.auto_renewing})
    return []


def verify(db: Session, token: str, sku: str, user_id: int | None = None, order_id: str | None = None) -> dict:
    if sku not in PRODUCTS or not 1 <= len(token) <= 4096:
        raise error(400, "Некорректная покупка.", "Invalid purchase.")
    # Serialize query + apply, so two workers cannot apply an older query after a newer one.
    begin_write(db)
    receipt = db.scalar(select(PlayPurchase).where(PlayPurchase.token_hash == token_hash(token)))
    if receipt:
        order = receipt.order
        if (user_id is not None and order.user_id != user_id) or (order_id and order.id != order_id) or order.product_id != sku:
            raise error(409, "Покупка связана с другим заказом.", "The purchase belongs to another order.")
        if order.provider == "mock":
            if not google.mock_enabled():
                raise error(503, "Тестовая оплата выключена.", "Test billing is disabled.")
            state = mock_state(receipt)
        else:
            state = google.verify(sku, token)
    else:
        state = google.verify(sku, token)
        order = db.get(PlayOrder, order_id or state.profile_id)
        if not order or order.provider != "google_play" or order.product_id != sku or (user_id is not None and order.user_id != user_id):
            raise error(409, "Заказ покупки не найден.", "The purchase order was not found.")
        if db.scalar(select(PlayPurchase.id).where(PlayPurchase.order_id == order.id)):
            raise error(409, "Заказ уже связан с покупкой.", "The order already has a purchase.")
        receipt = PlayPurchase(order=order, order_id=order.id, token_hash=token_hash(token), token=token)
        db.add(receipt)
    if not state.account_id or state.account_id != order.account_id or state.profile_id != order.id:
        raise error(409, "Покупка не соответствует аккаунту и заказу.", "Purchase account or order does not match.")
    mail_ids = apply_state(db, receipt, state)
    db.commit()  # Rights MUST be durable before consumption/acknowledgment.
    if state.access and not receipt.finalized:
        try:
            if order.provider == "google_play":
                google.finalize(sku, token)
            receipt.finalized = True
            db.commit()
        except google.PlayError:
            # Reconciliation and restore retry; access remains the already committed result.
            db.rollback()
    if receipt.cancellation_pending:
        cancel(db, receipt)
    if mail_ids:
        notifications.deliver_emails(db, mail_ids)
    return result(db, receipt)


def simulate(db: Session, user: User, order_id: str, state: str) -> dict:
    if not google.mock_enabled():
        raise error(404, "Не найдено.", "Not found.")
    uid = user.id
    begin_write(db)
    order = db.get(PlayOrder, order_id)
    if not order or order.user_id != uid or order.provider != "mock":
        raise error(404, "Заказ не найден.", "Order not found.")
    if state not in {"purchased", "pending", "canceled", "refunded", "renewed", "grace", "hold", "expired"}:
        raise error(400, "Неизвестное состояние.", "Unknown state.")
    if order.product_id != "month" and state in {"renewed", "grace", "hold", "expired"}:
        raise error(400, "Это не подписка.", "This is not a subscription.")
    receipt = db.scalar(select(PlayPurchase).where(PlayPurchase.order_id == order.id))
    if receipt is None:
        token = "mock-" + secrets.token_urlsafe(48)
        receipt = PlayPurchase(order_id=order.id, token=token, token_hash=token_hash(token), finalized=False)
        db.add(receipt)
    subscription = order.product_id == "month"
    expiry = as_utc(receipt.expires_at) if receipt.expires_at else utcnow() + dt.timedelta(days=90)
    if state == "renewed":
        expiry = max(expiry, utcnow()) + dt.timedelta(days=90)
    if state == "expired":
        expiry = utcnow() - dt.timedelta(seconds=1)
    normalized = "active" if subscription and state in {"purchased", "renewed"} else state
    receipt.mock_snapshot = json.dumps({"state": normalized, "expires_at": iso(expiry) if subscription else None,
        "auto_renewing": subscription and state not in {"canceled", "refunded", "expired"}})
    db.commit()
    token, sku = receipt.token, order.product_id
    return {**verify(db, token, sku, uid, order_id), "purchase_token": token}


def cancel(db: Session, receipt: PlayPurchase) -> bool:
    """Durable flag survives outages. A successful cancellation never re-enables renewal."""
    try:
        if receipt.order.provider == "google_play":
            current = google.verify(receipt.order.product_id, receipt.token)
            if current.auto_renewing:
                google.cancel_renewal(receipt.token)
                current = google.verify(receipt.order.product_id, receipt.token)
            if current.auto_renewing:
                return False
            receipt.auto_renewing = False
        else:
            if not google.mock_enabled():
                return False
            data = json.loads(receipt.mock_snapshot or "{}")
            data["auto_renewing"] = False
            if data.get("state") in {"active", "grace"}:
                data["state"] = "canceled"
            receipt.mock_snapshot = json.dumps(data)
            receipt.auto_renewing = False
        receipt.cancellation_pending = False
        receipt.cancellation_completed_at = utcnow()
        db.commit()
        return True
    except google.PlayError:
        db.rollback()
        return False


def reconcile(db: Session) -> dict:
    if google.enabled():
        try:
            reconcile_voided(db)
        except google.PlayError:
            db.rollback()
    rows = [(r.token, r.order.product_id) for r in db.scalars(select(PlayPurchase))]
    checked = failed = 0
    for token, sku in rows:
        try:
            verify(db, token, sku)
            checked += 1
        except Exception:
            db.rollback()
            failed += 1
    return {"checked": checked, "failed": failed}


def reconcile_voided(db: Session) -> int:
    hashes = {token_hash(token) for token in google.voided_tokens()}
    if not hashes:
        return 0
    begin_write(db)
    rows = db.scalars(select(PlayPurchase).where(PlayPurchase.token_hash.in_(hashes))).all()
    for row in rows:
        # A subscription token spans renewal orders: a voided historical charge must not
        # revoke a later paid period. subscriptionsv2 remains authoritative for subscriptions.
        if row.order.provider == "google_play" and row.order.product_id != "month":
            apply_state(db, row, google.State("refunded", row.order.account_id, row.order.id,
                                               expires_at=row.expires_at, finalized=row.finalized))
    db.commit()
    return len(rows)
