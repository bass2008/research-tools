from __future__ import annotations

from .. import sites

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..i18n import say, current_locale
from .. import access, audit, account_operations as operations
from .. import google_sign_in
from ..http_errors import LocalizedHTTPException, error
from ..config import settings
from ..db import get_db, begin_write
from ..deps import current_user, ghost_session, writable_user
from ..models import Reading, User, MetrikaClient, utcnow
from ..schemas import (Credentials, ResetApply, ResetRequest, MetrikaClientIn,
                       PasswordChange, EmailChange, OperationConfirm)
from .. import mail
from ..security import (create_reset_token, create_token, hash_password,
                        password_fingerprint, read_reset_token, verify_password)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google/config")
def google_config(request: Request) -> dict:
    google_sign_in.throttle(request, "config", cap=120, seconds=60)
    return google_sign_in.configuration()


@router.post("/google/challenge")
def google_challenge(request: Request, db: Session = Depends(get_db)) -> dict:
    return google_sign_in.challenge(db, request)


@router.post("/google")
def google_login(payload: google_sign_in.CredentialIn, request: Request, db: Session = Depends(get_db)):
    try:
        return google_sign_in.sign_in(db, request, payload)
    except (google_sign_in.LinkRequired, google_sign_in.EmailVerificationRequired) as exc:
        return JSONResponse({"detail": exc.detail, "messages": exc.messages,
                             "code": exc.code}, status_code=exc.status_code)


@router.post("/register")
def register(payload: Credentials, request: Request, db: Session = Depends(get_db)) -> dict:
    sites.current()  # Проверяем контекст до записи пользователя и отправки письма.
    ip = audit.client_ip(request)
    exists = db.scalar(select(User).where(User.email == payload.email))
    if exists:
        audit.record("register", "failed", email=payload.email, ip=ip)
        raise LocalizedHTTPException(status.HTTP_400_BAD_REQUEST, detail=lambda: say("auth.email_taken"))
    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        audit.record("register", "failed", email=payload.email, ip=ip)
        raise LocalizedHTTPException(status.HTTP_400_BAD_REQUEST,
                            detail=lambda: say("auth.email_taken")) from None
    db.refresh(user)
    mail.welcome(user.email)
    audit.record("register", "success", email=user.email, ip=ip)
    return {"token": create_token(user.id, user.password_hash, auth_version=user.auth_version), "user": user.public()}


@router.post("/login")
def login(payload: Credentials, request: Request, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(User.email == payload.email))
    ok = user is not None and not user.deleted_at and user.has_password and verify_password(payload.password, user.password_hash)
    audit.record("login", "success" if ok else "failed", email=payload.email,
                 ip=audit.client_ip(request))
    if not ok:
        raise LocalizedHTTPException(status.HTTP_401_UNAUTHORIZED, detail=lambda: say("auth.bad_credentials"))
    if user.deletion_requested_at:
        from ..account_deletion import session_response
        return session_response(db, user)
    return {"token": create_token(user.id, user.password_hash, auth_version=user.auth_version), "user": user.public()}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Что открыто — решают права, а не поле в users: у разового тарифа право привязано к
    матрице, у месячного распространяется на все."""
    used = db.scalar(select(func.count(Reading.id)).where(Reading.user_id == user.id,
                                                          Reading.product == "personal", Reading.removed_at.is_(None))) or 0
    rights = access.summary(db, user)
    from ..models import PlayOrder, PlayPurchase
    from ..play_billing import result as play_result
    subscriptions = db.scalars(select(PlayPurchase).join(PlayOrder).where(
        PlayOrder.user_id == user.id, PlayOrder.product_id == "month")).all()
    return {
        "user": user.public(),
        "pending_email_change": operations.pending(db, user.id),
        "access": rights,
        "matrices_used": int(used),
        # сколько дат можно держать: None — без ограничения, иначе бесплатная плюс купленные
        "matrices_limit": rights["matrices_limit"],
        # сколько дат куплено бессрочно — показывается рядом с подпиской, а не вместо неё
        "owned": rights["owned"],
        # признак админа: список почт в конфиге, поэтому колонки в users для этого нет
        "is_admin": settings.is_admin(user.email),
        "can_store": rights["can_store"],
        "unlimited": rights["unlimited_matrices"],
        "until": rights["until"],
        "google_play_subscriptions": [play_result(db, row) for row in subscriptions],
    }


@router.post("/reset/request")
def reset_request(payload: ResetRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    """Просьба о сбросе. Ответ одинаков и для существующей почты, и для чужой: иначе форма
    превращается в проверку, зарегистрирован ли адрес."""
    sites.current()
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is not None:
        token = create_reset_token(user.id, user.password_hash, user.email, user.auth_version)
        mail.reset(user.email, f"{mail.link_origin()}/{current_locale()}/reset?token={token}", settings.reset_ttl_hours)
    # исход журналируется внутренне; наружу ответ по-прежнему одинаков (без утечки перечисления)
    audit.record("reset", "success" if user is not None else "failed", email=payload.email,
                 ip=audit.client_ip(request))
    return {"ok": True, "sent": True}


@router.post("/reset/apply")
def reset_apply(payload: ResetApply, db: Session = Depends(get_db)) -> dict:
    read = read_reset_token(payload.token)
    if read is None:
        raise LocalizedHTTPException(status.HTTP_400_BAD_REQUEST,
                            detail=lambda: say("auth.link_invalid"))
    user_id, fingerprint, email, version = read
    begin_write(db)
    user = db.get(User, user_id)
    # отпечаток старого пароля в подписи: ссылкой нельзя воспользоваться дважды
    if user is None or user.deleted_at or password_fingerprint(user.password_hash) != fingerprint or user.email != email or user.auth_version != version:
        raise LocalizedHTTPException(status.HTTP_400_BAD_REQUEST,
                            detail=lambda: say("auth.link_used"))
    user.password_hash = hash_password(payload.password)
    user.has_password = True
    user.auth_version += 1
    user.email_verified_at = utcnow()
    operations.cancel_pending(db, user.id)
    db.commit()
    operations.service_mail(user.email, "password")
    if user.deletion_requested_at:
        from ..account_deletion import session_response
        return session_response(db, user)
    return {"token": create_token(user.id, user.password_hash, auth_version=user.auth_version), "user": user.public()}


@router.post("/metrika-client")
def metrika_client(payload: MetrikaClientIn, user: User = Depends(current_user),
                   ghost: bool = Depends(ghost_session), db: Session = Depends(get_db)) -> dict:
    """Связь браузера с текущим аккаунтом. Вход админа под пользователем не учитывается."""
    if ghost:
        return {"ok": True}
    from sqlalchemy.dialects.sqlite import insert
    stamp = utcnow()
    row = insert(MetrikaClient).values(
        user_id=user.id, counter_id=payload.counter_id, client_id=payload.client_id,
        site_origin=sites.current().origin, first_seen_at=stamp, last_seen_at=stamp,
    )
    db.execute(row.on_conflict_do_update(
        index_elements=["user_id", "counter_id", "client_id"],
        set_={"last_seen_at": func.max(MetrikaClient.last_seen_at, row.excluded.last_seen_at)},
    ))
    db.commit()
    return {"ok": True}


@router.post("/password/change")
def change_password(payload: PasswordChange, request: Request, user: User = Depends(current_user),
                    ghost: bool = Depends(ghost_session), db: Session = Depends(get_db)) -> dict:
    uid, version = user.id, user.auth_version
    operations.throttle(request, uid, "password_change")
    begin_write(db)
    user = writable_user(db, uid, version, ghost)
    operations.change_password(db, user, payload.current_password, payload.new_password)
    audit.record("password_change", "success", email=user.email, ip=audit.client_ip(request))
    return {"token": create_token(uid, user.password_hash, auth_version=user.auth_version), "user": user.public()}


@router.post("/email/verification/request")
def verification_request(request: Request, user: User = Depends(current_user),
                         ghost: bool = Depends(ghost_session), db: Session = Depends(get_db)) -> dict:
    uid, version = user.id, user.auth_version
    operations.throttle(request, uid, "email_verify", sending=True)
    begin_write(db)
    user = writable_user(db, uid, version, ghost)
    result = operations.request_email(db, user, None)
    audit.record("email_verify", "success", email=user.email, ip=audit.client_ip(request))
    return result


@router.post("/email/change/request")
def email_change_request(payload: EmailChange, request: Request, user: User = Depends(current_user),
                         ghost: bool = Depends(ghost_session), db: Session = Depends(get_db)) -> dict:
    uid, version = user.id, user.auth_version
    operations.throttle(request, uid, "email_change", sending=True)
    begin_write(db)
    user = writable_user(db, uid, version, ghost)
    operations.check_password(user, payload.current_password)
    result = operations.request_email(db, user, payload.new_email)
    audit.record("email_change", "success", email=user.email, ip=audit.client_ip(request))
    return result


@router.post("/email/verification/confirm")
def verification_confirm(payload: OperationConfirm, db: Session = Depends(get_db),
                         ghost: bool = Depends(ghost_session)) -> dict:
    if ghost:
        raise error(403, "Подтверждение в чужом кабинете недоступно.", "Confirmation is unavailable while impersonating.")
    return operations.confirm_email(db, payload.token, "verify_email")


@router.post("/email/change/confirm")
def email_change_confirm(payload: OperationConfirm, db: Session = Depends(get_db),
                         ghost: bool = Depends(ghost_session)) -> dict:
    if ghost:
        raise error(403, "Подтверждение в чужом кабинете недоступно.", "Confirmation is unavailable while impersonating.")
    return operations.confirm_email(db, payload.token, "change_email")
