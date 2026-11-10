"""Thirty-day recovery window for the shared website/mobile account.

Financial rows and provider tokens survive with an inaccessible pseudonymous user. They
are not advertised as anonymous and need the seller's retention policy before publication.
"""
from __future__ import annotations

import datetime as dt
import json
import logging

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from . import account_operations, mail, play_billing, sites
from .config import settings
from .db import begin_write, get_db
from .deps import bearer
from .http_errors import error
from .i18n import current_locale
from .models import (AccountOperation, Entitlement, GoogleAuthChallenge, GoogleIdentity, IndividualReading, MetrikaClient, Notification,
                     NotificationDelivery, Payment, PaymentSweep, PlayOrder, PlayPurchase,
                     Purchase, Reading, ReportJob, SecurityAudit, User, as_utc, iso, utcnow)
from .security import create_restore_token, create_token, password_fingerprint, read_restore_token
from .store import store

RECOVERY_DAYS = 30
log = logging.getLogger("arcana.account_deletion")


def deadline(user: User) -> dt.datetime | None:
    return as_utc(user.deletion_requested_at) + dt.timedelta(days=RECOVERY_DAYS) if user.deletion_requested_at else None


def status(db: Session, user: User) -> dict:
    pending = db.scalar(select(PlayPurchase.id).join(PlayOrder).where(
        PlayOrder.user_id == user.id, PlayPurchase.cancellation_pending.is_(True)).limit(1))
    return {"requested_at": iso(user.deletion_requested_at), "delete_at": iso(deadline(user)),
            "renewal_cancellation": "pending" if pending else "complete"}


def session_response(db: Session, user: User) -> dict:
    if user.deleted_at or not deadline(user) or deadline(user) <= utcnow():
        raise error(403, "Срок восстановления аккаунта закончился.", "The account recovery period has ended.")
    return {"token": create_restore_token(user.id, user.password_hash, user.auth_version),
            "user": user.public(), "deletion": status(db, user)}


def restoring_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
                   db: Session = Depends(get_db)) -> User:
    read = read_restore_token(credentials.credentials) if credentials else None
    user = db.get(User, read[0]) if read else None
    if (not user or not user.deletion_requested_at or user.deleted_at or user.auth_version != read[2]
            or password_fingerprint(user.password_hash) != read[1] or deadline(user) <= utcnow()):
        raise error(401, "Войдите снова для восстановления.", "Sign in again to restore the account.")
    return user


def request_deletion(db: Session, user: User, password: str) -> dict:
    account_operations.check_password(user, password)
    # Administrator identity must remain usable for the existing local and deployment workflows.
    if settings.is_admin(user.email):
        raise error(403, "Удаление административного аккаунта выполняется отдельно.",
                    "Administrator account deletion is handled separately.")
    if user.deletion_requested_at:
        return session_response(db, user)
    user.deletion_requested_at = utcnow()
    user.deletion_locale, user.deletion_origin = current_locale(), sites.current().origin
    user.auth_version += 1
    account_operations.cancel_pending(db, user.id)
    subscriptions = list(db.scalars(select(PlayPurchase).join(PlayOrder).where(
        PlayOrder.user_id == user.id, PlayOrder.product_id == "month")))
    for receipt in subscriptions:
        # Query even the last known inactive state; an unseen renewal may have happened.
        receipt.cancellation_pending = True
    db.commit()  # Never lose the deletion/cancellation request if Google is unavailable.
    for receipt in subscriptions:
        play_billing.cancel(db, receipt)
    reply = session_response(db, user)
    en = user.deletion_locale == "en"
    pending = reply["deletion"]["renewal_cancellation"] == "pending"
    when = deadline(user).strftime("%Y-%m-%d")
    text = (f"Your shared Arcana Sense account will be deleted on {when}." if en else
            f"Общий аккаунт Arcana Sense будет удалён {when}.")
    text += "\n" + (("Cancellation of future Google Play charges is still pending." if en else
                      "Отключение будущих списаний Google Play ещё выполняется.") if pending else
                     ("Future Google Play charges have been disabled." if en else
                      "Будущие списания Google Play отключены."))
    text += "\n" + ("To restore your account, sign in before that date. Renewal stays disabled." if en else
                     "Для восстановления войдите до этой даты. Автопродление останется выключенным.")
    text += f"\n{user.deletion_origin}/{user.deletion_locale}/account/delete"
    try:
        mail.send(user.email, "Account deletion requested" if en else "Запрошено удаление аккаунта", text)
    except Exception:
        log.warning("Deletion service email could not be sent")
    return reply


def restore(db: Session, user: User) -> dict:
    uid, version = user.id, user.auth_version
    begin_write(db)
    user = db.get(User, uid, populate_existing=True)
    if user.deleted_at or user.auth_version != version or not deadline(user) or deadline(user) <= utcnow():
        raise error(401, "Восстановление недоступно.", "Account restoration is unavailable.")
    user.deletion_requested_at = None
    user.deletion_locale = user.deletion_origin = None
    user.auth_version += 1
    # Pending cancellations remain pending and are retried: restore is not permission to charge again.
    db.commit()
    return {"token": create_token(uid, user.password_hash, auth_version=user.auth_version), "user": user.public()}


def purge(db: Session, user_id: int) -> bool:
    begin_write(db)
    user = db.get(User, user_id, populate_existing=True)
    if not user or user.deleted_at or not deadline(user) or deadline(user) > utcnow():
        return False
    uid = user.id
    individual_ids = set(db.scalars(select(IndividualReading.id).where(IndividualReading.user_id == uid)))
    # Failure leaves the request and rows intact for the next sweep. Historical PDFs included.
    store().delete_account(uid, individual_ids)
    for key in db.scalars(select(ReportJob.object_key).where(ReportJob.user_id == uid, ReportJob.object_key.is_not(None))):
        store().delete(key)
    purchases = list(db.scalars(select(Purchase).where(Purchase.user_id == uid)))
    purchase_ids = {p.id for p in purchases}
    payment_ids = set(db.scalars(select(Payment.id).where(Payment.user_id == uid)))
    reading_ids = set(db.scalars(select(Reading.id).where(Reading.user_id == uid)))
    emails = {user.email}
    for op in db.scalars(select(AccountOperation).where(AccountOperation.user_id == uid)):
        data = json.loads(op.data)
        emails.update(value for key, value in data.items() if "email" in key and isinstance(value, str))
    db.execute(update(SecurityAudit).where(SecurityAudit.email.in_(emails)).values(email=None, ip=None))
    # User deliveries may share notifications with admins; remove PII from those retained notes.
    own_notes = set(db.scalars(select(NotificationDelivery.notification_id).where(NotificationDelivery.user_id == uid)))
    db.execute(delete(NotificationDelivery).where(NotificationDelivery.user_id == uid))
    for note in db.scalars(select(Notification)):
        data = json.loads(note.data)
        affected = (note.id in own_notes or data.get("buyer_email") in emails or
                    data.get("purchase_id") in purchase_ids or data.get("reading_id") in reading_ids or
                    data.get("user_id") == uid)
        if not affected:
            continue
        if not db.scalar(select(NotificationDelivery.id).where(NotificationDelivery.notification_id == note.id).limit(1)):
            db.delete(note)
        else:
            note.data = json.dumps({k: v for k, v in data.items() if k in {
                "amount", "currency", "offer_name", "paid_at", "purchase_id", "payment_id", "product",
                "site_origin", "locale", "until", "source"}})
    for job in db.scalars(select(PaymentSweep)):
        entries = job.entries()
        changed = False
        for entry in entries:
            if entry.get("payment") in payment_ids or entry.get("email") in emails:
                entry.pop("email", None); entry.pop("error", None); changed = True
        if changed:
            job.log = json.dumps(entries)
    for purchase in purchases:
        purchase.reading_id = None
        purchase.offer_body = json.dumps({k: v for k, v in purchase.body().items() if k in {
            "id", "name", "price", "amount_confirmed", "scope", "products", "per_reading", "store_unlimited",
            "period_days", "currency", "channel", "locale", "site_origin", "auto_renewing"}})
    db.flush()
    for model in (ReportJob, Entitlement, IndividualReading, Reading, AccountOperation, MetrikaClient,
                  GoogleAuthChallenge, GoogleIdentity):
        db.execute(delete(model).where(model.user_id == uid))
    user.email, user.password_hash = f"deleted-{uid}@invalid", "!deleted"
    user.has_password = False
    user.last_seen_at = user.email_verified_at = None
    user.deletion_origin = user.deletion_locale = None
    user.auth_version += 1
    user.deleted_at = utcnow()
    db.commit()
    return True


def sweep(db: Session) -> dict:
    result = {"canceled": 0, "purged": 0, "failed": 0}
    for receipt in db.scalars(select(PlayPurchase).where(PlayPurchase.cancellation_pending.is_(True))).all():
        if play_billing.cancel(db, receipt):
            result["canceled"] += 1
    ids = list(db.scalars(select(User.id).where(User.deletion_requested_at.is_not(None), User.deleted_at.is_(None))))
    for uid in ids:
        try:
            result["purged"] += int(purge(db, uid))
        except Exception:
            db.rollback()
            result["failed"] += 1
            log.warning("Account cleanup will be retried, id=%s", uid)
    return result
