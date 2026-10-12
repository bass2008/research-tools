from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import access, readings
from ..db import get_db
from ..deps import current_user
from ..models import Reading, User
from ..schemas import MatrixTitleIn, ReadingIn

router = APIRouter(prefix="/readings", tags=["readings"])


@router.get("")
def listing(product: str | None = None, user: User = Depends(current_user),
            db: Session = Depends(get_db)) -> dict:
    query = select(Reading).where(Reading.user_id == user.id)
    if product:
        query = query.where(Reading.product == product)
    rows = db.scalars(query.order_by(Reading.id.desc())).all()
    rights = access.active_rights(db, user)
    return {"items": [{**row.item(), **access.reading_state(rights, row),
                       "unlocked": access.can_open(db, user, row, rights=rights)} for row in rows]}


@router.post("")
def create(payload: ReadingIn, user: User = Depends(current_user),
           db: Session = Depends(get_db)) -> dict:
    product = readings.product_or_404(payload.product)
    row = readings.create(db, user, product, payload.inputs, payload.title)
    db.commit()
    db.refresh(row)
    # разовое право могло быть куплено до ввода — этот разбор и есть оплаченный;
    # уже открытый разбор вторым правом не занимаем
    if not access.can_open(db, user, row):
        access.bind_unbound(db, user, row)
    return readings.card(db, user, row)


@router.get("/{reading_id}")
def one(reading_id: int, user: User = Depends(current_user),
        db: Session = Depends(get_db)) -> dict:
    return readings.card(db, user, readings.own(db, user, reading_id))


@router.patch("/{reading_id}")
def rename(reading_id: int, payload: MatrixTitleIn, user: User = Depends(current_user),
           db: Session = Depends(get_db)) -> dict:
    """Подписать разбор. Кроме имени менять нечего: ввод — это и есть сам разбор."""
    row = readings.own(db, user, reading_id)
    row.title = (payload.title or "").strip() or None
    db.commit()
    db.refresh(row)
    return readings.card(db, user, row)
