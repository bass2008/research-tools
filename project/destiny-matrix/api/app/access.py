"""Доступ считается по правам, а не по «тарифу пользователя».

Два тарифа устроены по-разному: разовый относится к одной матрице, месячный — ко всем сразу.
Одно поле в users такое выразить не может, поэтому источник истины — записи в entitlements.
"""
from __future__ import annotations

import datetime as dt

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Entitlement, Payment, SavedMatrix, Tariff, User, utcnow

# виды доступа
SINGLE = "single"    # один разбор по одной дате
MATRIX = "matrix"    # хранить и открывать матрицы в кабинете
ALL = "all"          # без ограничения числа дат


def active_rights(db: Session, user: User | None,
                  now: dt.datetime | None = None) -> list[Entitlement]:
    if user is None:
        return []
    now = now or utcnow()
    rows = db.scalars(select(Entitlement).where(Entitlement.user_id == user.id)).all()
    return [r for r in rows if r.active(now)]


def scopes(db: Session, user: User | None, now: dt.datetime | None = None) -> set[str]:
    """Все виды доступа, которые сейчас есть у пользователя."""
    out: set[str] = set()
    for right in active_rights(db, user, now):
        out.update(right.scopes())
    return out


def unlocked_matrix(db: Session, user: User | None, matrix_id: int | None,
                    now: dt.datetime | None = None) -> bool:
    """Открыт ли полный разбор конкретной матрицы.

    Право со `all` открывает любую; право с `single` — только ту, к которой привязано.
    """
    for right in active_rights(db, user, now):
        kinds = right.scopes()
        if ALL in kinds:
            return True
        if SINGLE in kinds and matrix_id is not None and right.matrix_id == matrix_id:
            return True
    return False


def bind_single(db: Session, user: User, matrix_id: int,
                now: dt.datetime | None = None) -> bool:
    """Привязать разовое право к матрице, если оно куплено раньше, чем введена дата.

    Дата рождения в платёжный запрос не входит (так обещано в оферте), поэтому купленное право
    приходит без матрицы. Оплаченной становится первая дата, к которой право применили.
    """
    for right in active_rights(db, user, now):
        kinds = right.scopes()
        if SINGLE in kinds and ALL not in kinds and right.matrix_id is None:
            right.matrix_id = matrix_id
            db.commit()
            return True
    return False


def can_save_more(db: Session, user: User, now: dt.datetime | None = None) -> bool:
    """Хранение матриц — право `matrix`. Без него в кабинете держим одну, чтобы был смысл войти."""
    if MATRIX in scopes(db, user, now):
        return True
    saved = db.scalar(select(SavedMatrix).where(SavedMatrix.user_id == user.id).limit(1))
    return saved is None


def grant(db: Session, user: User, tariff: Tariff, payment: Payment | None = None,
          matrix_id: int | None = None, now: dt.datetime | None = None) -> Entitlement:
    """Выдать право по тарифу. Срок считается один раз, из снимка, и потом не двигается."""
    now = now or utcnow()
    expires = None if tariff.period_days is None else now + dt.timedelta(days=tariff.period_days)
    right = Entitlement(user_id=user.id, payment_id=payment.id if payment else None,
                        scope=tariff.scope, starts_at=now, expires_at=expires,
                        matrix_id=matrix_id if SINGLE in tariff.scopes() and ALL not in
                        tariff.scopes() else None)
    db.add(right)
    db.flush()
    return right


def summary(db: Session, user: User | None, now: dt.datetime | None = None) -> dict:
    """Что показать в кабинете: какие виды доступа есть и до какого числа."""
    rights = active_rights(db, user, now)
    kinds = sorted({k for r in rights for k in r.scopes()})
    ends = [r.expires_at for r in rights if r.expires_at is not None]
    unlimited = any(r.expires_at is None for r in rights)
    return {
        "scopes": kinds,
        "unlimited_matrices": ALL in kinds,
        "can_store": MATRIX in kinds,
        # ближайшая дата окончания среди срочных прав; None — либо ничего нет, либо есть бессрочное
        "until": None if unlimited or not ends else max(ends).isoformat(),
        "rights": [r.item() for r in rights],
    }
