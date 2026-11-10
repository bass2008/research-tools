"""Google authenticates an identity; Arcana retains ownership of accounts and sessions.

Only public certificates are fetched. Credentials, nonces and passwords are never logged
or stored; anonymous challenges expire and are removed on the next challenge request.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import re
import secrets
import threading
import time
from collections import OrderedDict, deque
from dataclasses import dataclass

from fastapi import Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field, TypeAdapter
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import audit, sites
from .config import settings
from .db import begin_write
from .http_errors import LocalizedHTTPException, error
from .i18n import current_locale
from .models import GoogleAuthChallenge, GoogleIdentity, User, as_utc, utcnow
from .security import create_token, hash_password, verify_password

CHALLENGE_SECONDS = 300
MAX_ATTEMPTS = 8
MAX_CHALLENGES = 2000
_rate_lock = threading.Lock()
_rates: OrderedDict[str, deque] = OrderedDict()
_email = TypeAdapter(EmailStr)


class CredentialIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    credential: str = Field(min_length=20, max_length=8192, strict=True)
    challenge: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$", strict=True)
    current_password: str | None = Field(default=None, min_length=1, max_length=200, strict=True)


class LinkRequired(LocalizedHTTPException):
    code = "google_link_required"

    def __init__(self):
        super().__init__(409, detail=lambda: "Confirm the existing account password to link Google."
                         if current_locale() == "en" else
                         "Подтвердите пароль существующего аккаунта, чтобы связать Google.")


class EmailVerificationRequired(LocalizedHTTPException):
    code = "google_email_verification_required"

    def __init__(self):
        super().__init__(403, detail=lambda: "Register with email and verify the address before connecting Google."
                         if current_locale() == "en" else
                         "Зарегистрируйтесь по почте и подтвердите адрес, затем подключите Google.")


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _ip_hash(request: Request) -> str:
    return hmac.new(settings.jwt_secret.encode(), (audit.client_ip(request) or "unknown").encode(),
                    hashlib.sha256).hexdigest()


def throttle(request: Request, action: str, *, cap: int = 30, seconds: int = 300) -> None:
    key, now = f"{action}:{_ip_hash(request)}", time.monotonic()
    with _rate_lock:
        stamps = _rates.setdefault(key, deque())
        while stamps and stamps[0] <= now - seconds:
            stamps.popleft()
        _rates.move_to_end(key)
        while len(_rates) > 4096:
            _rates.popitem(last=False)
        if len(stamps) >= cap:
            raise error(429, "Слишком много запросов. Попробуйте позже.", "Too many requests. Please try later.")
        stamps.append(now)


def configuration() -> dict:
    audience = settings.google_sign_in_client_id.strip()
    enabled = bool(re.fullmatch(r"[A-Za-z0-9_-]+\.apps\.googleusercontent\.com", audience))
    return {"enabled": enabled, "client_id": audience if enabled else None}


def _client_id() -> str:
    config = configuration()
    if not config["enabled"]:
        raise error(503, "Вход через Google пока недоступен.", "Google Sign-In is not available yet.")
    return config["client_id"]


def challenge(db: Session, request: Request) -> dict:
    audience, origin = _client_id(), sites.current().origin
    throttle(request, "challenge")
    now, ip = utcnow(), _ip_hash(request)
    begin_write(db)
    db.execute(delete(GoogleAuthChallenge).where(GoogleAuthChallenge.expires_at <= now))
    count = db.scalar(select(func.count()).select_from(GoogleAuthChallenge)) or 0
    personal = db.scalar(select(func.count()).select_from(GoogleAuthChallenge).where(
        GoogleAuthChallenge.ip_hash == ip)) or 0
    if count >= MAX_CHALLENGES or personal >= 30:
        db.rollback()
        raise error(429, "Слишком много запросов. Попробуйте позже.", "Too many requests. Please try later.")
    key, nonce = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    db.add(GoogleAuthChallenge(id=digest(key), nonce_hash=digest(nonce), client_id=audience,
        site_origin=origin, ip_hash=ip, expires_at=now + dt.timedelta(seconds=CHALLENGE_SECONDS)))
    db.commit()
    return {"challenge": key, "nonce": nonce, "client_id": audience}


def _invalid():
    return error(401, "Не удалось подтвердить вход через Google. Начните вход заново.",
                 "Google Sign-In could not be verified. Please start again.")


def _challenge(db: Session, raw: str, audience: str, origin: str) -> GoogleAuthChallenge:
    row = db.scalar(select(GoogleAuthChallenge).where(GoogleAuthChallenge.id == digest(raw)).with_for_update())
    if (not row or row.consumed_at or as_utc(row.expires_at) <= utcnow()
            or row.client_id != audience or row.site_origin != origin):
        raise _invalid()
    return row


@dataclass(frozen=True)
class Identity:
    subject: str
    email: str
    authoritative: bool


def verify(credential: str, audience: str, nonce_hash: str) -> Identity:
    from google.auth.exceptions import TransportError
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2 import id_token
    import requests

    try:
        with requests.Session() as session:
            transport = GoogleRequest(session=session)

            def bounded_request(*args, **kwargs):
                kwargs["timeout"] = 10
                return transport(*args, **kwargs)

            claims = id_token.verify_oauth2_token(credential, bounded_request, audience)
    except TransportError:
        raise error(503, "Google не отвечает. Попробуйте позже.", "Google is unavailable. Please try later.") from None
    except Exception:
        # Google/library exceptions may contain token claims: never expose their messages.
        raise _invalid() from None
    now = int(utcnow().timestamp())
    if (not isinstance(claims, dict) or claims.get("aud") != audience
            or claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com")
            or claims.get("email_verified") is not True
            or type(claims.get("exp")) is not int or claims["exp"] <= now
            or type(claims.get("iat")) is not int or claims["iat"] > now + 30
            or claims["exp"] <= claims["iat"]):
        raise _invalid()
    nonce, subject, address, domain = (claims.get(k) for k in ("nonce", "sub", "email", "hd"))
    if (not isinstance(nonce, str) or len(nonce) > 255 or not hmac.compare_digest(digest(nonce), nonce_hash)
            or not isinstance(subject, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,255}", subject)
            or not isinstance(address, str) or len(address) > 320
            or domain is not None and (not isinstance(domain, str)
                or not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?", domain))):
        raise _invalid()
    try:
        address = str(_email.validate_python(address)).strip().lower()
    except ValueError:
        raise _invalid() from None
    return Identity(subject, address, address.endswith("@gmail.com") or bool(domain))


def _allowed(user: User | None, address: str) -> None:
    if settings.is_admin(address) or user and settings.is_admin(user.email):
        raise error(403, "Для этого аккаунта используйте вход по паролю.", "Use password sign-in for this account.")
    if user and user.deleted_at:
        raise _invalid()


def sign_in(db: Session, request: Request, payload: CredentialIn) -> dict:
    audience, origin = _client_id(), sites.current().origin
    throttle(request, "login")
    begin_write(db)
    row = _challenge(db, payload.challenge, audience, origin)
    if row.attempts >= MAX_ATTEMPTS:
        raise _invalid()
    row.attempts += 1
    nonce_hash = row.nonce_hash
    db.commit()  # Each attempt is bounded, including invalid signatures and password retries.
    identity = verify(payload.credential, audience, nonce_hash)
    begin_write(db)  # Do not hold the account write lock during Google's certificate request.
    row = _challenge(db, payload.challenge, audience, origin)
    if row.subject_hash and not hmac.compare_digest(row.subject_hash, digest(identity.subject)):
        raise _invalid()
    linked = db.scalar(select(GoogleIdentity).where(GoogleIdentity.subject == identity.subject).with_for_update())
    by_email = db.scalar(select(User).where(User.email == identity.email).with_for_update())
    user = db.scalar(select(User).where(User.id == linked.user_id).with_for_update()) if linked else by_email
    _allowed(user, identity.email)
    if (linked and (not user or by_email and by_email.id != user.id)
            or row.user_id is not None and (not user or row.user_id != user.id or row.auth_version != user.auth_version)):
        raise _invalid()
    new_user = user is None
    if not linked and not identity.authoritative and (not user or not user.email_verified_at):
        # A Google account can retain a historically verified third-party address
        # after that mailbox changes owners. Never attach that identity before Arcana
        # has independently verified current mailbox ownership.
        raise EmailVerificationRequired()
    if not linked and user:
        other = db.scalar(select(GoogleIdentity).where(GoogleIdentity.user_id == user.id))
        if other:
            raise error(409, "Аккаунт уже связан с другим входом Google.", "This account is already linked to another Google identity.")
        # An attacker can pre-register someone else's email with their own password.
        # Google's ownership proof must not silently preserve that unverified login.
        if not (identity.authoritative and user.email_verified_at):
            row.subject_hash, row.user_id, row.auth_version = digest(identity.subject), user.id, user.auth_version
            if not payload.current_password:
                db.commit()
                raise LinkRequired()
            if not user.has_password or not verify_password(payload.current_password, user.password_hash):
                db.commit()
                raise error(401, "Текущий пароль неверен.", "The current password is incorrect.")
    try:
        if new_user:
            user = User(email=identity.email, password_hash=hash_password(secrets.token_urlsafe(48)),
                        has_password=False, email_verified_at=utcnow() if identity.authoritative else None)
            db.add(user)
            db.flush()
        if not linked:
            db.add(GoogleIdentity(subject=identity.subject, user_id=user.id))
        if identity.authoritative and user.email == identity.email and not user.email_verified_at:
            user.email_verified_at = utcnow()
        # A pending deletion returns only its recovery capability, exactly like password login.
        if user.deletion_requested_at:
            from .account_deletion import session_response
            response = session_response(db, user)
        else:
            response = {"token": create_token(user.id, user.password_hash, auth_version=user.auth_version),
                        "user": user.public()}
        row.user_id, row.subject_hash = user.id, digest(identity.subject)
        row.auth_version, row.consumed_at = user.auth_version, utcnow()
        db.commit()
    except IntegrityError:
        db.rollback()
        raise error(409, "Не удалось связать аккаунт. Начните вход заново.",
                    "The account could not be linked. Please start sign-in again.") from None
    audit.record("register" if new_user else "login", "success", email=user.email, ip=audit.client_ip(request))
    return response
