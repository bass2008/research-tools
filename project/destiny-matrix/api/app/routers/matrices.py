from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import access, tariffs
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import SavedMatrix, User, iso
from ..report import build_report
from ..schemas import MatrixIn, MatrixTitleIn

router = APIRouter(prefix="/matrices", tags=["matrices"])

MONTHS = ("января", "февраля", "марта", "апреля", "мая", "июня",
          "июля", "августа", "сентября", "октября", "ноября", "декабря")


def _default_title(birth: dt.date) -> str:
    return f"Матрица {birth.day} {MONTHS[birth.month - 1]} {birth.year}"


def _saved(db: Session, user_id: int) -> int:
    return int(db.scalar(select(func.count(SavedMatrix.id))
                         .where(SavedMatrix.user_id == user_id)) or 0)


def _needs_storage_right(db: Session, used: int) -> HTTPException:
    """Слоты кончились: одна дата бесплатно плюс по одной за каждое купленное разовое право.

    Названия тарифов берём из справочника: они живут в базе и меняются без правки кода.
    """
    single = next((t for t in tariffs.public_tariffs(db) if access.ALL not in t.scopes()), None)
    offer = f"«{single.name}» откроет ещё одну" if single else ""
    return HTTPException(
        status.HTTP_402_PAYMENT_REQUIRED,
        detail=f"Сохранено {used} — все оплаченные даты заняты. {offer}." if offer
        else f"Сохранено {used} — все оплаченные даты заняты.",
    )


@router.get("")
def listing(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(
        select(SavedMatrix).where(SavedMatrix.user_id == user.id).order_by(SavedMatrix.id.desc())
    ).all()
    # права читаем один раз на весь список: в кабинете видно, какая дата куплена, какая открыта
    # подпиской, а какая закрыта
    rights = access.active_rights(db, user)
    return {"items": [{**row.item(), **access.matrix_state(rights, row.id)} for row in rows]}


@router.post("")
def create(payload: MatrixIn, user: User = Depends(current_user),
           db: Session = Depends(get_db)) -> dict:
    used = _saved(db, user.id)
    # та же дата второй раз — повторное сохранение, а не новая матрица: слот не тратится
    row = db.scalar(select(SavedMatrix).where(SavedMatrix.user_id == user.id,
                                             SavedMatrix.birth == payload.birth,
                                             SavedMatrix.sex == payload.sex))
    if row is None:
        if used >= settings.matrices_hard_cap:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Достигнут предохранитель в {settings.matrices_hard_cap} матриц")
        if not access.can_save_more(db, user):
            raise _needs_storage_right(db, used)
        try:
            row = SavedMatrix(user_id=user.id, birth=payload.birth, sex=payload.sex,
                              title=(payload.title or _default_title(payload.birth)))
            build_report(payload.birth, payload.sex, unlocked=False)
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

        db.add(row)
        db.commit()
        db.refresh(row)
    # разовое право могло быть куплено до ввода даты — эта матрица и есть оплаченная;
    # уже открытую дату вторым правом не занимаем
    if not access.unlocked_matrix(db, user, row.id):
        access.bind_single(db, user, row.id)
    # разбор считаем ещё раз: право могло быть выдано именно на эту матрицу при оплате
    report = build_report(row.birth, row.sex,
                          unlocked=access.unlocked_matrix(db, user, row.id))
    return {"id": row.id, "title": row.title, "created_at": iso(row.created_at),
            **access.matrix_state(access.active_rights(db, user), row.id), **report}


@router.get("/{matrix_id}")
def one(matrix_id: int, user: User = Depends(current_user),
        db: Session = Depends(get_db)) -> dict:
    row = db.get(SavedMatrix, matrix_id)
    # чужая матрица отдаёт 404, а не 403: существование чужих записей знать незачем
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Матрица не найдена")
    report = build_report(row.birth, row.sex,
                          unlocked=access.unlocked_matrix(db, user, row.id))
    return {"id": row.id, "title": row.title, "created_at": iso(row.created_at),
            **access.matrix_state(access.active_rights(db, user), row.id), **report}


@router.patch("/{matrix_id}")
def rename(matrix_id: int, payload: MatrixTitleIn, user: User = Depends(current_user),
           db: Session = Depends(get_db)) -> dict:
    """Подписать матрицу. Кроме имени менять нечего: дата и пол — это и есть сама матрица."""
    row = db.get(SavedMatrix, matrix_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Матрица не найдена")
    title = (payload.title or "").strip()
    row.title = title or _default_title(row.birth)
    db.commit()
    db.refresh(row)
    return {**row.item(), **access.matrix_state(access.active_rights(db, user), row.id)}
