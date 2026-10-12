"""Личные разборы прежним адресом: `/matrices` — это `/readings` продукта `personal`.

Фронт личного разбора и старые вкладки ходят сюда; ответы те же, что и раньше.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import access, products, readings
from ..db import get_db
from ..deps import current_user
from ..models import User
from ..schemas import MatrixIn, MatrixTitleIn

router = APIRouter(prefix="/matrices", tags=["matrices"])

PERSONAL = products.PRODUCTS[products.PERSONAL]


@router.post("")
def create(payload: MatrixIn, user: User = Depends(current_user),
           db: Session = Depends(get_db)) -> dict:
    row = readings.create(db, user, PERSONAL, {"birth": payload.birth, "sex": payload.sex},
                          payload.title)
    db.commit()
    db.refresh(row)
    # разовое право могло быть куплено до ввода даты — эта матрица и есть оплаченная;
    # уже открытую дату вторым правом не занимаем
    if not access.can_open(db, user, row):
        access.bind_unbound(db, user, row)
    return readings.card(db, user, row)


@router.get("/{matrix_id}")
def one(matrix_id: int, user: User = Depends(current_user),
        db: Session = Depends(get_db)) -> dict:
    return readings.card(db, user, readings.own(db, user, matrix_id, products.PERSONAL))


@router.patch("/{matrix_id}")
def rename(matrix_id: int, payload: MatrixTitleIn, user: User = Depends(current_user),
           db: Session = Depends(get_db)) -> dict:
    """Подписать матрицу. Кроме имени менять нечего: дата и пол — это и есть сама матрица."""
    row = readings.own(db, user, matrix_id, products.PERSONAL)
    row.title = (payload.title or "").strip() or None
    db.commit()
    db.refresh(row)
    return {**row.item(), **access.reading_state(access.active_rights(db, user), row)}
