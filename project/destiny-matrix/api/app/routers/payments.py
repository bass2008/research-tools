from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import access, tariffs
from ..config import settings
from ..db import get_db
from ..models import Payment, SavedMatrix, User, utcnow
from ..schemas import PaymentIn
from ..security import create_token, hash_password, random_password

router = APIRouter(prefix="/payments", tags=["payments"])


def _matrix_for(db: Session, user: User, payload: PaymentIn) -> SavedMatrix | None:
    """Разовый тариф покупают для конкретной даты, поэтому право нужно к чему-то привязать."""
    if payload.matrix_id is not None:
        row = db.get(SavedMatrix, payload.matrix_id)
        if row is None or row.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Матрица не найдена")
        return row
    if payload.birth is None:
        # дата ещё не введена: привяжем право к последней сохранённой матрице, а если её нет —
        # к первой, которую сохранят после оплаты (см. access.bind_single)
        return db.scalar(select(SavedMatrix).where(SavedMatrix.user_id == user.id)
                         .order_by(SavedMatrix.id.desc()).limit(1))
    row = SavedMatrix(user_id=user.id, birth=payload.birth, sex=payload.sex or "f",
                      title=None)
    db.add(row)
    db.flush()
    return row


@router.post("/mock")
def pay_mock(payload: PaymentIn, db: Session = Depends(get_db)) -> dict:
    if not settings.mock_payments:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Мок-оплата отключена")

    tariff = tariffs.get(db, payload.tariff)
    if tariff is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Такого тарифа нет")

    user = db.scalar(select(User).where(User.email == payload.email))
    autoregistered = user is None
    if user is None:
        user = User(email=payload.email, password_hash=hash_password(random_password()))
        db.add(user)
        try:
            db.flush()
        except IntegrityError:               # гонка двух оплат одной почтой
            db.rollback()
            user = db.scalar(select(User).where(User.email == payload.email))
            if user is None:
                raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                    detail="Не удалось создать пользователя") from None
            autoregistered = False

    matrix = _matrix_for(db, user, payload) if access.SINGLE in tariff.scopes() \
        and access.ALL not in tariff.scopes() else None

    now = utcnow()
    payment = Payment(user_id=user.id, tariff_body=json.dumps(tariff.body(), ensure_ascii=False), amount=tariff.price,
        matrix_id=matrix.id if matrix else None, created_at=now, paid_at=now,
        external_id=f"mock-{uuid.uuid4().hex[:24]}")
    db.add(payment)
    db.flush()

    right = access.grant(db, user, tariff, payment=payment,
                         matrix_id=matrix.id if matrix else None, now=now)
    db.commit()
    db.refresh(user)

    # Токен выдаём только вместе с автосозданием аккаунта. Иначе достаточно знать чужую почту,
    # чтобы «купить» и получить доступ к чужим матрицам вместе с датами рождения.
    body = {
        "ok": True,
        "payment_id": payment.external_id,
        "user": user.public(),
        "autoregistered": autoregistered,
        "tariff": tariff.public(),
        "entitlement": right.item(),
        "matrix_id": matrix.id if matrix else None,
        "mock": True,
    }
    if autoregistered:
        body["token"] = create_token(user.id)
    else:
        body["token"] = None
        body["requires_login"] = True
    return body
