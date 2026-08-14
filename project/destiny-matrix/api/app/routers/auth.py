from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import access
from ..db import get_db
from ..deps import current_user
from ..models import SavedMatrix, User
from ..schemas import Credentials
from ..security import create_token, hash_password, verify_password

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
        "can_store": rights["can_store"],
        "unlimited": rights["unlimited_matrices"],
        "until": rights["until"],
    }
