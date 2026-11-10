"""Операции реквизитов. Сервисные письма не создают бизнес-уведомлений."""
from __future__ import annotations

import datetime as dt
import json
import logging
import threading
import time
from collections import defaultdict, deque

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from . import audit, mail, sites
from .config import settings
from .http_errors import error
from .db import begin_write
from .i18n import current_locale
from .models import AccountOperation, User, as_utc, iso, utcnow
from .security import create_operation_token, read_operation_token, verify_password, hash_password

_rate_lock = threading.Lock()
_rates: dict[str, deque] = defaultdict(deque)


# A user's whole hourly allowance can be spent back to back, so a typo and a retry never wait;
# the cap bounds password guessing, and letters are spaced by the DB cooldown in request_email.
def throttle(request: Request, user_id: int, action: str, *, sending: bool = False) -> None:
    now = time.monotonic()
    keys = [(f"{action}:user:{user_id}", 5 if sending else 15),
            (f"{action}:ip:{audit.client_ip(request)}", 60)]
    with _rate_lock:
        for key in list(_rates):
            while _rates[key] and _rates[key][0] <= now - 3600:
                _rates[key].popleft()
            if not _rates[key]:
                del _rates[key]
        for key, cap in keys:
            if len(_rates.get(key, ())) >= cap:
                raise error(429, "Слишком много запросов. Попробуйте позже.", "Too many requests. Please try later.")
        for key, _ in keys:
            _rates[key].append(now)


def cancel_pending(db: Session, user_id: int) -> None:
    db.execute(update(AccountOperation).where(AccountOperation.user_id == user_id,
        AccountOperation.completed_at.is_(None), AccountOperation.canceled_at.is_(None))
        .values(canceled_at=utcnow()))


def pending(db: Session, user_id: int) -> dict | None:
    op = db.scalar(select(AccountOperation).where(AccountOperation.user_id == user_id,
        AccountOperation.type == "change_email", AccountOperation.completed_at.is_(None),
        AccountOperation.canceled_at.is_(None), AccountOperation.expires_at > utcnow()))
    if not op:
        return None
    d = json.loads(op.data)
    return {"new_email": d["new_email"], "expires_at": iso(op.expires_at),
            "old_confirmed": bool(d.get("old_confirmed")), "new_confirmed": bool(d.get("new_confirmed")),
            "require_old_confirmation": d["require_old_confirmation"]}


def check_password(user: User, raw: str) -> None:
    if not user.has_password or not verify_password(raw, user.password_hash):
        raise error(400, "Текущий пароль неверен.", "The current password is incorrect.")


def service_mail(to: str, kind: str, *, link: str = "", new_email: str = "", locale: str | None = None) -> bool:
    en = (locale or current_locale()) == "en"
    texts = {
        "verify": ("Подтвердите почту", "Confirm your email", "Подтвердите доступ к вашей почте.", "Confirm access to your email."),
        "new": ("Подтвердите новый email", "Confirm your new email", "Подтвердите новый адрес аккаунта.", "Confirm the new email for your account."),
        "old": ("Разрешите смену email", "Approve email change", "Запрошена смена email на", "An email change was requested to"),
        "requested": ("Запрошена смена email", "Email change requested", "Запрошена смена email на", "An email change was requested to"),
        "changed": ("Email аккаунта изменён", "Account email changed", "Новый адрес аккаунта:", "Your new account email:"),
        "password": ("Пароль изменён", "Password changed", "Пароль вашего аккаунта изменён.", "Your account password has changed."),
    }
    ru_subject, en_subject, ru_body, en_body = texts[kind]
    body = (en_body if en else ru_body) + (f" {new_email}" if new_email else "")
    if link:
        body += "\n\n" + link + "\n\n" + (("Link valid for 24 hours." if kind == "verify" else "Link valid for 30 minutes.") if en else ("Ссылка действует 24 часа." if kind == "verify" else "Ссылка действует 30 минут."))
    body += "\n\n" + ("If this was not you, contact " if en else "Если это были не вы, напишите: ") + settings.mail_reply_to
    try:
        return mail.send(to, en_subject if en else ru_subject, body)
    except Exception:
        logging.getLogger("arcana.account_operations").exception("Ошибка сервисного письма type=%s", kind)
        return False


def request_email(db: Session, user: User, new_email: str | None) -> dict:
    if new_email is not None:
        if settings.is_admin(user.email) or settings.is_admin(new_email):
            raise error(403, "Административный адрес изменяется отдельно.", "Administrator email changes are handled separately.")
        if new_email == user.email or db.scalar(select(User.id).where(User.email == new_email)):
            raise error(409, "Этот адрес недоступен для смены.", "This email cannot be used for this change.")
    elif user.email_verified_at:
        return {"ok": True, "already_verified": True}
    elif pending(db, user.id):
        raise error(409, "Сначала завершите смену email.", "Complete your email change first.")
    # DB cooldown survives process restarts, complements the IP/password limit.
    last = db.scalar(select(AccountOperation).where(AccountOperation.user_id == user.id)
                     .order_by(AccountOperation.id.desc()).limit(1))
    if last and (utcnow()-as_utc(last.created_at)).total_seconds() < 60:
        raise error(429, "Повторить отправку можно через минуту.", "You can resend after one minute.")
    cancel_pending(db, user.id)
    d = {"email": user.email, "version": user.auth_version, "site_origin": sites.current().origin,
         "locale": current_locale(), "new_email": new_email,
         "require_old_confirmation": bool(user.email_verified_at), "old_confirmed": False, "new_confirmed": False}
    expires = utcnow() + (dt.timedelta(minutes=30) if new_email else dt.timedelta(hours=24))
    op = AccountOperation(user_id=user.id, type="change_email" if new_email else "verify_email",
                          data=json.dumps(d), expires_at=expires)
    db.add(op)
    db.commit()
    def link(purpose: str) -> str:
        token = create_operation_token(op.id, user.id, purpose, expires)
        return f"{mail.link_origin(d['site_origin'])}/{d['locale']}/account/confirm#token={token}&kind={op.type}"
    if new_email:
        sent = service_mail(new_email, "new", link=link("verify_new"))
        old_sent = service_mail(user.email, "old" if d["require_old_confirmation"] else "requested",
                               link=link("approve_old") if d["require_old_confirmation"] else "", new_email=new_email)
        sent = sent and (old_sent or not d["require_old_confirmation"])
    else:
        sent = service_mail(user.email, "verify", link=link("verify_current"))
    if not sent and not settings.mail_to_log:
        raise error(503, "Не удалось отправить письмо. Повторите запрос позже.", "Could not send the email. Please retry later.")
    return {"ok": True, "expires_at": iso(expires), "retry_after_seconds": 60,
            "pending_email_change": pending(db, user.id)}


def confirm_email(db: Session, token: str, expected: str) -> dict:
    claims = read_operation_token(token)
    if not claims:
        raise error(400, "Ссылка недействительна или истекла.", "The link is invalid or expired.")
    oid, uid, purpose = claims
    begin_write(db)
    op = db.get(AccountOperation, oid)
    user = db.get(User, uid)
    if (
        not op or not user or op.user_id != uid or op.type != expected
        or op.canceled_at or op.completed_at or as_utc(op.expires_at) <= utcnow()
    ):
        raise error(400, "Ссылка уже использована или недействительна.", "The link has already been used or is invalid.")
    data = json.loads(op.data)
    if user.auth_version != data["version"] or user.email != data["email"]:
        raise error(400, "Реквизиты аккаунта изменились. Запросите новую ссылку.", "Account details changed. Request a new link.")
    if expected == "verify_email":
        if purpose != "verify_current":
            raise error(400, "Неверное назначение ссылки.", "Invalid link purpose.")
        user.email_verified_at = utcnow()
        op.completed_at = utcnow()
        db.commit()
        return {"ok": True, "verified": True}
    if settings.is_admin(user.email) or settings.is_admin(data["new_email"]):
        raise error(403, "Административный адрес изменяется отдельно.", "Administrator email changes are handled separately.")
    if purpose == "verify_new":
        data["new_confirmed"] = True
    elif purpose == "approve_old" and data["require_old_confirmation"]:
        data["old_confirmed"] = True
    else:
        raise error(400, "Неверное назначение ссылки.", "Invalid link purpose.")
    op.data = json.dumps(data)
    complete = data["new_confirmed"] and (not data["require_old_confirmation"] or data["old_confirmed"])
    if not complete:
        db.commit()
        return {"ok": True, "changed": False, "waiting_for": "new" if not data["new_confirmed"] else "old"}
    if db.scalar(select(User.id).where(User.email == data["new_email"], User.id != uid)):
        raise error(409, "Этот адрес уже недоступен. Начните смену заново.", "This email is no longer available. Start a new request.")
    old = user.email
    user.email = data["new_email"]
    user.email_verified_at = utcnow()
    user.auth_version += 1
    op.completed_at = utcnow()
    db.flush()
    cancel_pending(db, uid)
    db.commit()
    for address in (old, user.email):
        service_mail(address, "changed", new_email=user.email, locale=data["locale"])
    audit.record("email_change", "success", email=user.email)
    return {"ok": True, "changed": True}


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    check_password(user, current_password)
    user.password_hash = hash_password(new_password)
    user.has_password = True
    user.auth_version += 1
    cancel_pending(db, user.id)
    db.commit()
    service_mail(user.email, "password")
