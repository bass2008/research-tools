from __future__ import annotations

import base64
import json
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import account_deletion, account_operations, play_billing
from ..db import begin_write, get_db
from ..deps import current_user, ghost_session, optional_user, writable_user
from ..http_errors import error
from ..models import PlayNotification, PlayOrder, PlayPurchase, User
from ..payments import google_play as google
from ..config import settings

router = APIRouter(prefix="/mobile", tags=["mobile"])


class OrderIn(BaseModel):
    product_id: Literal["single", "pair", "month"]
    reading_id: int | None = Field(default=None, gt=0)
    inputs: dict | None = None


class ReceiptIn(BaseModel):
    product_id: Literal["single", "pair", "month"]
    purchase_token: str = Field(min_length=1, max_length=4096)
    order_id: str | None = Field(default=None, max_length=48)


class RestoreIn(BaseModel):
    purchases: list[ReceiptIn] = Field(default_factory=list, max_length=100)


class MockIn(BaseModel):
    order_id: str = Field(min_length=1, max_length=48)
    state: Literal["purchased", "pending", "canceled", "refunded", "renewed", "grace", "hold", "expired"]


class DeleteIn(BaseModel):
    current_password: str = Field(min_length=3, max_length=200)


def no_ghost(ghost: bool = Depends(ghost_session)) -> None:
    if ghost:
        raise error(403, "Оплата и удаление в чужом кабинете недоступны.", "Billing and deletion are unavailable while impersonating.")


def unavailable(exc: google.PlayError):
    # Provider errors are intentionally generic; upstream URLs include credentials.
    return error(502, "Не удалось проверить покупку в Google Play. Повторите позже.",
                 "Unable to verify the Google Play purchase. Please try again later.")


@router.get("/billing/status")
def billing_status(user: User | None = Depends(optional_user), db: Session = Depends(get_db)) -> dict:
    mode = play_billing.provider()
    receipts = db.scalars(select(PlayPurchase).join(PlayOrder).where(
        PlayOrder.user_id == user.id, PlayOrder.product_id == "month")).all() if user else []
    return {"provider": mode, "products": [{"product_id": sku, "type": "subs" if sku == "month" else "in-app"}
            for sku in play_billing.PRODUCTS] if mode else [],
            "subscriptions": [play_billing.result(db, row) for row in receipts]}


@router.post("/billing/orders", dependencies=[Depends(no_ghost)])
def order(payload: OrderIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return play_billing.create_order(db, user, payload.product_id, payload.reading_id, payload.inputs)


@router.post("/billing/verify", dependencies=[Depends(no_ghost)])
def verify(payload: ReceiptIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    try:
        return play_billing.verify(db, payload.purchase_token, payload.product_id, user.id, payload.order_id)
    except google.PlayError as exc:
        raise unavailable(exc) from exc


@router.post("/billing/mock", dependencies=[Depends(no_ghost)])
def mock(payload: MockIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return play_billing.simulate(db, user, payload.order_id, payload.state)


@router.post("/billing/restore", dependencies=[Depends(no_ghost)])
def restore_purchases(payload: RestoreIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    uid = user.id
    receipts = {row.token: row.order.product_id for row in db.scalars(select(PlayPurchase).join(PlayOrder).where(PlayOrder.user_id == uid))}
    receipts.update({r.purchase_token: r.product_id for r in payload.purchases})
    results = []
    failed = 0
    for token, sku in receipts.items():
        try:
            results.append(play_billing.verify(db, token, sku, uid))
        except Exception:
            db.rollback()
            failed += 1
    return {"items": results, "failed": failed}


@router.post("/billing/rtdn")
def rtdn(request: Request, payload: dict, db: Session = Depends(get_db)) -> dict:
    try:
        google.authenticate_push(request.headers.get("authorization"))
    except google.PlayError as exc:
        raise error(401, "Недействительный отправитель.", "Invalid sender.") from exc
    try:
        message = payload["message"]
        message_id = str(message["messageId"])
        if not 1 <= len(message_id) <= 200 or len(message["data"]) > 65536:
            raise ValueError("Invalid envelope")
        body = json.loads(base64.b64decode(message["data"], validate=True))
        if body.get("packageName") != settings.google_play_package:
            raise ValueError("Wrong package")
    except (ValueError, KeyError, TypeError) as exc:
        raise error(400, "Некорректное уведомление.", "Invalid notification.") from exc
    if db.get(PlayNotification, message_id):
        return {"ok": True, "duplicate": True}
    notice = body.get("subscriptionNotification") or body.get("oneTimeProductNotification") or body.get("voidedPurchaseNotification")
    if notice:
        token = notice.get("purchaseToken", "")
        receipt = db.scalar(select(PlayPurchase).where(PlayPurchase.token_hash == play_billing.token_hash(token)))
        sku = receipt.order.product_id if receipt else notice.get("sku") or notice.get("subscriptionId") or "month"
        try:
            play_billing.verify(db, token, sku)
            if body.get("voidedPurchaseNotification"):
                play_billing.reconcile_voided(db)
        except google.PlayError as exc:
            raise unavailable(exc) from exc
    elif not body.get("testNotification"):
        raise error(400, "Неизвестное уведомление.", "Unknown notification.")
    db.add(PlayNotification(message_id=message_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # The same message completed concurrently; entitlement processing is idempotent.
    return {"ok": True}


@router.post("/account/delete", dependencies=[Depends(no_ghost)])
def delete_account(payload: DeleteIn, request: Request, user: User = Depends(current_user),
                   ghost: bool = Depends(ghost_session), db: Session = Depends(get_db)) -> dict:
    uid, version = user.id, user.auth_version
    account_operations.throttle(request, uid, "account_delete")
    begin_write(db)
    user = writable_user(db, uid, version, ghost)
    return account_deletion.request_deletion(db, user, payload.current_password)


@router.get("/account/deletion")
def deletion_status(user: User = Depends(account_deletion.restoring_user), db: Session = Depends(get_db)) -> dict:
    return {"user": user.public(), "deletion": account_deletion.status(db, user)}


@router.post("/account/restore")
def restore_account(user: User = Depends(account_deletion.restoring_user), db: Session = Depends(get_db)) -> dict:
    return account_deletion.restore(db, user)
