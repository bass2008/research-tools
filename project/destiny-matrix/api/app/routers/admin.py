"""Админка: кто зарегистрирован, что купил, какие даты сохранил.

Только чтение. Признак админа — почта из `settings.admins`, а не колонка в users: схема без
миграций, и новое поле заставило бы пересоздавать таблицу вместе с платежами.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import access
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import Payment, SavedMatrix, User, iso

router = APIRouter(prefix="/admin", tags=["admin"])


def admin_user(user: User = Depends(current_user)) -> User:
    if not settings.is_admin(user.email):
        # 404, а не 403: существование админских адресов посторонним знать незачем
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Не найдено")
    return user


def _row(db: Session, user: User) -> dict:
    rights = access.active_rights(db, user)
    paid = db.execute(
        select(func.count(Payment.id), func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.user_id == user.id, Payment.paid_at.is_not(None),
               Payment.refunded_at.is_(None))
    ).one()
    summary = access.summary(db, user)
    return {
        "id": user.id,
        "email": user.email,
        "created_at": iso(user.created_at),
        "is_admin": settings.is_admin(user.email),
        "matrices": access.saved_count(db, user),
        "payments": int(paid[0]),
        "spent": int(paid[1]),
        "scopes": summary["scopes"],
        "owned": summary["owned"],
        "until": summary["until"],
        "rights": len(rights),
    }


@router.get("/users")
def users(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(User).order_by(User.id.desc())).all()
    return {"items": [_row(db, u) for u in rows]}


@router.get("/payments")
def payments(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Все платежи с почтой плательщика: в кабинете видны только свои."""
    rows = db.execute(
        select(Payment, User.email).join(User, User.id == Payment.user_id)
        .order_by(Payment.id.desc())
    ).all()
    return {"items": [{**payment.item(), "user_id": payment.user_id, "email": email}
                      for payment, email in rows]}


@router.get("/users/{user_id}")
def one(user_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Карточка пользователя: его матрицы и его платежи."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    rights = access.active_rights(db, user)
    matrices = db.scalars(
        select(SavedMatrix).where(SavedMatrix.user_id == user.id).order_by(SavedMatrix.id.desc())
    ).all()
    payment_rows = db.scalars(
        select(Payment).where(Payment.user_id == user.id).order_by(Payment.id.desc())
    ).all()
    return {
        "user": _row(db, user),
        "matrices": [{**m.item(), **access.matrix_state(rights, m.id)} for m in matrices],
        "payments": [p.item() for p in payment_rows],
        "rights": [r.item() for r in rights],
    }
