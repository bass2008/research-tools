from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import access, mail, tariffs
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import Payment, SavedMatrix, User, default_title, utcnow
from ..schemas import PaymentIn
from ..security import create_token, hash_password, random_password

router = APIRouter(prefix="/payments", tags=["payments"])


def _matrix_for(db: Session, user: User, payload: PaymentIn) -> SavedMatrix:
    """За какую дату платят. Разовый тариф без цели не продаётся: право, которому не к чему
    прилипнуть, оставляет человека с оплатой и без разбора."""
    if payload.matrix_id is not None:
        row = db.get(SavedMatrix, payload.matrix_id)
        if row is None or row.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Матрица не найдена")
    elif payload.birth is not None:
        # та же дата второй раз — та же запись: платёж не должен плодить дубли
        row = db.scalar(select(SavedMatrix).where(SavedMatrix.user_id == user.id,
                                                 SavedMatrix.birth == payload.birth,
                                                 SavedMatrix.sex == (payload.sex or "f")))
        if row is None:
            row = SavedMatrix(user_id=user.id, birth=payload.birth, sex=payload.sex or "f",
                              title=default_title(payload.birth))
            db.add(row)
            db.flush()
    else:
        # дату могли сохранить до оплаты: платят за последнюю, которая ещё закрыта
        rows = db.scalars(select(SavedMatrix).where(SavedMatrix.user_id == user.id)
                          .order_by(SavedMatrix.id.desc())).all()
        found = next((r for r in rows if not access.unlocked_matrix(db, user, r.id)), None)
        if found is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                detail="Укажите дату, за которую платите: доступ к одной дате "
                                       "нельзя купить впрок")
        row = found
    if access.unlocked_matrix(db, user, row.id):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail="Эта дата уже открыта — второй раз платить не нужно")
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
        # что именно открылось — по данным сервера: экран после оплаты не должен додумывать
        "matrix": matrix.item() if matrix else None,
        "mock": True,
    }
    if autoregistered:
        body["token"] = create_token(user.id)
    else:
        body["token"] = None
        body["requires_login"] = True

    # письмо после оплаты — единственное подтверждение доступа, которое остаётся у человека
    # на руках; отказ почты платёж не отменяет
    mail.purchase(user.email, tariff.name, payment.external_id)
    return body


@router.get("")
def listing(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """История платежей кабинета. Снимок тарифа лежит в самом платеже, поэтому смена цены
    задним числом историю не переписывает."""
    rows = db.scalars(select(Payment).where(Payment.user_id == user.id)
                      .order_by(Payment.id.desc())).all()
    return {"items": [row.item() for row in rows]}
