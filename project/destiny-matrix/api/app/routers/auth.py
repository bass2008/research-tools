from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import access
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import SavedMatrix, User
from ..schemas import Credentials, ResetApply, ResetRequest
from .. import mail
from ..security import (create_reset_token, create_token, hash_password,
                        password_fingerprint, read_reset_token, verify_password)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register(payload: Credentials, db: Session = Depends(get_db)) -> dict:
    exists = db.scalar(select(User).where(User.email == payload.email))
    if exists:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Эта почта уже зарегистрирована")
    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Эта почта уже зарегистрирована") from None
    db.refresh(user)
    mail.welcome(user.email)
    return {"token": create_token(user.id), "user": user.public()}


@router.post("/login")
def login(payload: Credentials, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверная почта или пароль")
    return {"token": create_token(user.id), "user": user.public()}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Что открыто — решают права, а не поле в users: у разового тарифа право привязано к
    матрице, у месячного распространяется на все."""
    used = db.scalar(select(func.count(SavedMatrix.id)).where(SavedMatrix.user_id == user.id)) or 0
    rights = access.summary(db, user)
    return {
        "user": user.public(),
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
    }


@router.post("/reset/request")
def reset_request(payload: ResetRequest, db: Session = Depends(get_db)) -> dict:
    """Просьба о сбросе. Ответ одинаков и для существующей почты, и для чужой: иначе форма
    превращается в проверку, зарегистрирован ли адрес."""
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is not None:
        token = create_reset_token(user.id, user.password_hash)
        mail.reset(user.email, f"{settings.site_url}/reset?token={token}", settings.reset_ttl_hours)
    return {"ok": True, "sent": True}


@router.post("/reset/apply")
def reset_apply(payload: ResetApply, db: Session = Depends(get_db)) -> dict:
    read = read_reset_token(payload.token)
    if read is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Ссылка недействительна или просрочена")
    user_id, fingerprint = read
    user = db.get(User, user_id)
    # отпечаток старого пароля в подписи: ссылкой нельзя воспользоваться дважды
    if user is None or password_fingerprint(user.password_hash) != fingerprint:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Ссылка уже использована — запросите новую")
    user.password_hash = hash_password(payload.password)
    db.commit()
    return {"token": create_token(user.id), "user": user.public()}
