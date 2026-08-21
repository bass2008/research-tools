"""Доступ считается по правам, а не по «тарифу пользователя».

Два тарифа устроены по-разному: разовый относится к одной матрице, месячный — ко всем сразу.
Одно поле в users такое выразить не может, поэтому источник истины — записи в entitlements.
"""
from __future__ import annotations

import datetime as dt

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Entitlement, Payment, SavedMatrix, Tariff, User, iso, utcnow

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


def matrix_state(rights: list[Entitlement], matrix_id: int) -> dict:
    """Как открыта конкретная матрица — для списка в кабинете.

    `forever` — куплена бессрочным правом и останется; `subscription` — открыта, пока действует
    срочное право (с датой окончания); `locked` — закрыта, разбор можно выкупить. Права передаются
    списком, а не считаются заново на каждую строку: иначе список кабинета — запрос на матрицу.
    """
    ends: list[dt.datetime] = []
    for right in rights:
        kinds = right.scopes()
        if ALL not in kinds and not (SINGLE in kinds and right.matrix_id == matrix_id):
            continue
        if right.expires_at is None:
            return {"access": "forever", "access_until": None}
        ends.append(right.expires_at)
    if ends:
        return {"access": "subscription", "access_until": iso(max(ends))}
    return {"access": "locked", "access_until": None}


def bind_single(db: Session, user: User, matrix_id: int,
                now: dt.datetime | None = None) -> bool:
    """Привязать разовое право к матрице, если оно осталось без неё.

    Новые платежи всегда указывают дату, так что таких прав больше не появляется. Функция лечит
    права, купленные до этого правила: оплаченной становится первая дата, к которой их применили.
    """
    for right in active_rights(db, user, now):
        kinds = right.scopes()
        if SINGLE in kinds and ALL not in kinds and right.matrix_id is None:
            right.matrix_id = matrix_id
            # история платежей обязана показывать дату, которую открыл платёж
            payment = db.get(Payment, right.payment_id) if right.payment_id else None
            if payment is not None and payment.matrix_id is None:
                payment.matrix_id = matrix_id
            db.commit()
            return True
    return False


def single_slots(db: Session, user: User | None, now: dt.datetime | None = None) -> int:
    """Сколько дат оплачено разовыми правами: одно право — одна дата, покупать можно сколько угодно."""
    return sum(1 for right in active_rights(db, user, now)
               if SINGLE in right.scopes() and ALL not in right.scopes())


def saved_count(db: Session, user: User) -> int:
    return int(db.scalar(select(func.count(SavedMatrix.id))
                         .where(SavedMatrix.user_id == user.id)) or 0)


def matrices_limit(db: Session, user: User, now: dt.datetime | None = None) -> int | None:
    """Сколько матриц можно держать в кабинете. None — без ограничения.

    Одна бесплатная, чтобы вход имел смысл, плюс по одной за каждое купленное разовое право:
    иначе второй платёж не смог бы открыть вторую дату. Право `matrix` снимает счёт совсем.
    """
    if MATRIX in scopes(db, user, now):
        return None
    return 1 + single_slots(db, user, now)


def can_save_more(db: Session, user: User, now: dt.datetime | None = None) -> bool:
    limit = matrices_limit(db, user, now)
    return limit is None or saved_count(db, user) < limit


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
    singles = [r for r in rights if SINGLE in r.scopes() and ALL not in r.scopes()]
    return {
        "scopes": kinds,
        "unlimited_matrices": ALL in kinds,
        "can_store": MATRIX in kinds,
        # None — без ограничения; иначе бесплатная плюс по одной за каждое разовое право
        "matrices_limit": None if MATRIX in kinds else 1 + len(singles),
        # сколько дат куплено бессрочно: покупка и подписка живут одновременно, и кабинет
        # обязан показывать обе — раньше одна затирала другую
        "owned": sum(1 for r in singles if r.expires_at is None),
        # дата окончания срочного доступа. Наличие бессрочных покупок её не отменяет: подписка
        # кончится, а купленные даты останутся
        "until": max(ends).isoformat() if ends else None,
        "rights": [r.item() for r in rights],
    }
