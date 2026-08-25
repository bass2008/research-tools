from __future__ import annotations

import datetime as dt
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import access, mail, payments, printing, tariffs
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import (Entitlement, Payment, SavedMatrix, User, as_utc, default_title,
                      utcnow)
from ..schemas import PaymentIn, PaymentRef
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


def _buyer(db: Session, email: str) -> tuple[User, bool]:
    user = db.scalar(select(User).where(User.email == email))
    if user is not None:
        return user, False
    user = User(email=email, password_hash=hash_password(random_password()))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:                   # гонка двух оплат одной почтой
        db.rollback()
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                detail="Не удалось создать пользователя") from None
        return user, False
    return user, True


def _target(db: Session, user: User, payload: PaymentIn, tariff) -> SavedMatrix | None:
    if access.SINGLE in tariff.scopes() and access.ALL not in tariff.scopes():
        return _matrix_for(db, user, payload)
    return None


def _tariff(db: Session, code: str):
    tariff = tariffs.get(db, code)
    if tariff is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Такого тарифа нет")
    return tariff


def _grant_once(db: Session, payment: Payment, now: dt.datetime) -> Entitlement:
    """Право на платёж выдаётся один раз: провайдер сообщает об оплате несколько раз и повторяет
    уведомление, пока не получит подтверждение приёма."""
    right = db.scalar(select(Entitlement).where(Entitlement.payment_id == payment.id))
    if right is not None:
        return right
    body = payment.body()
    tariff = tariffs.get(db, body["id"]) or _tariff(db, body["id"])
    user = db.get(User, payment.user_id)
    payment.paid_at = payment.paid_at or now
    return access.grant(db, user, tariff, payment=payment, matrix_id=payment.matrix_id, now=now)


def apply(db: Session, payment: Payment, update: payments.Update) -> Payment:
    """Единственное место, где исход платежа превращается в права. Названия статусов сюда не
    доходят — провайдер отдаёт нормализованный исход."""
    now = utcnow()
    payment.status = update.status or payment.status
    outcome = update.outcome
    if outcome is payments.Outcome.CANCELED:
        # деньги уже списаны — значит это возврат, иначе просто снятый холд
        outcome = (payments.Outcome.REFUNDED if payment.paid_at is not None
                   else payments.Outcome.FAILED)
    if outcome is payments.Outcome.PAID:
        right = _grant_once(db, payment, now)
        fresh = right.starts_at == now
        db.commit()
        if fresh:
            mail.purchase(payment.user.email, payment.body()["name"], payment.external_id)
            # печать начинается сразу, не дожидаясь нажатия: на слабой машине она идёт десятки
            # секунд, и человеку незачем их ждать. Нажал раньше времени — запрос дождётся этой же
            # печати, второго рендера не будет.
            printing.warm(payment.user_id, payment.matrix_id)
    elif outcome is payments.Outcome.REFUNDED:
        first = payment.refunded_at is None
        payment.refunded_at = payment.refunded_at or now
        for right in db.scalars(select(Entitlement)
                                .where(Entitlement.payment_id == payment.id)).all():
            right.revoked_at = right.revoked_at or now
        db.commit()
        if first and payment.paid_at is not None:
            mail.refund(payment.user.email, payment.body()["name"], payment.external_id)
    else:
        db.commit()
    db.refresh(payment)
    return payment


def _provider_of(payment: Payment) -> payments.Provider:
    provider = payments.get(payment.provider)
    if provider is None or not provider.enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Этот способ оплаты сейчас недоступен")
    return provider


def _reusable(db: Session, user: User, matrix: SavedMatrix | None,
              provider: payments.Provider) -> Payment | None:
    """Начатый, но не доведённый платёж за ту же дату. Две открытые страницы оплаты — это два
    независимых источника события, и без этой проверки каждая выставляла свой счёт: на живом
    терминале выходило два платежа по одной дате."""
    if matrix is None:
        return None
    rows = db.scalars(
        select(Payment).where(Payment.user_id == user.id, Payment.matrix_id == matrix.id,
                              Payment.provider == provider.name,
                              Payment.paid_at.is_(None), Payment.refunded_at.is_(None),
                              Payment.order_id.is_not(None), Payment.pay_url.is_not(None))
        .order_by(Payment.id.desc()).limit(5)
    ).all()
    for row in rows:
        if (utcnow() - as_utc(row.created_at)).total_seconds() > settings.payment_reuse_seconds:
            continue
        # какие статусы ещё позволяют доплатить, знает провайдер, а не роутер
        if not provider.reusable(row.status):
            continue
        # Спрашиваем провайдера, жива ли ссылка. Без этого после отказа карты человек попадал на
        # страницу уже отклонённого платежа и вылетал на «Платёж не прошёл», не увидев формы: у нас
        # статус оставался NEW, потому что уведомление на отказ не приходит, а страница отказа
        # сверку не делала. Заплатить другой картой было нельзя целых полчаса.
        try:
            apply(db, row, provider.state(row.external_id))
        except payments.PaymentError:
            continue                               # провайдер не ответил — старый счёт не предлагаем
        if row.paid_at is None and row.refunded_at is None and provider.reusable(row.status):
            return row
    return None


def _body(db: Session, payment: Payment, user: User, matrix: SavedMatrix | None,
          tariff, order: str, autoregistered: bool) -> dict:
    right = db.scalar(select(Entitlement).where(Entitlement.payment_id == payment.id))
    body = {"ok": True, "order_id": order, "payment_id": payment.external_id,
            "payment_url": payment.pay_url, "status": payment.status,
            "paid": payment.paid_at is not None, "provider": payment.provider,
            "user": user.public(), "autoregistered": autoregistered,
            "tariff": tariff.public(), "entitlement": right.item() if right else None,
            "matrix_id": matrix.id if matrix else None,
            "matrix": matrix.item() if matrix else None}
    # Токен выдаём только вместе с автосозданием аккаунта: иначе достаточно знать чужую почту,
    # чтобы «купить» и попасть в чужой кабинет.
    body["token"] = create_token(user.id, user.password_hash) if autoregistered else None
    if not autoregistered:
        body["requires_login"] = True
    return body


def _open(db: Session, payload: PaymentIn, provider: payments.Provider) -> dict:
    """Один путь для всех способов оплаты: покупатель, дата, платёж, обращение к провайдеру и
    применение исхода. Права выдаёт только apply(), поэтому мок и живой банк не расходятся."""
    tariff = _tariff(db, payload.tariff)
    user, autoregistered = _buyer(db, payload.email)
    matrix = _target(db, user, payload, tariff)

    started_earlier = _reusable(db, user, matrix, provider)
    if started_earlier is not None:
        db.commit()
        return _body(db, started_earlier, user, matrix, tariff, started_earlier.order_id or "",
                     autoregistered)

    payment = Payment(user_id=user.id, tariff_body=json.dumps(tariff.body(), ensure_ascii=False),
                      amount=tariff.price, matrix_id=matrix.id if matrix else None,
                      external_id=f"new-{uuid.uuid4().hex[:24]}", provider=provider.name,
                      status="NEW")
    db.add(payment)
    db.flush()

    order = payments.order_id(payment.id)
    try:
        started = provider.start(order, tariff.price, tariff.name, user.email)
    except payments.PaymentError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    payment.external_id = started.external_id
    payment.pay_url = started.pay_url
    payment.status = started.status
    payment.order_id = order
    db.flush()
    apply(db, payment, payments.Update(external_id=started.external_id, order_id=order,
                                       outcome=started.outcome, status=started.status))
    db.refresh(user)

    return _body(db, payment, user, matrix, tariff, order, autoregistered)


@router.post("/start")
def start(payload: PaymentIn, db: Session = Depends(get_db)) -> dict:
    provider = payments.active()
    if provider is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Оплата не настроена")
    return _open(db, payload, provider)


@router.post("/notify/{provider_name}")
def notify(provider_name: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    """Уведомление провайдера. Подлинность проверяет он сам: без неё доступ открывал бы любой."""
    provider = payments.get(provider_name)
    if provider is None or not provider.enabled():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Нет такого способа оплаты")
    try:
        update = provider.read_notification(payload)
    except payments.PaymentError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    payment = _find(db, update.external_id, update.order_id)
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Платёж не найден")
    apply(db, payment, update)
    return {"ok": True, "status": payment.status}


@router.post("/notify")
def notify_default(payload: dict, db: Session = Depends(get_db)) -> dict:
    """Адрес без имени провайдера остаётся живым: он записан в платежах, созданных до перехода
    на маршрут с именем."""
    return notify("tbank", payload, db)


@router.post("/sync")
def sync(payload: PaymentRef, user: User = Depends(current_user),
         db: Session = Depends(get_db)) -> dict:
    """Спросить провайдера о статусе: на возвращении с формы уведомление могло не дойти."""
    payment = _find(db, None, payload.order_id)
    if payment is None or payment.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Платёж не найден")
    provider = payments.get(payment.provider)
    if provider is not None and provider.enabled():
        try:
            apply(db, payment, provider.state(payment.external_id))
        except payments.PaymentError as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {"ok": True, "status": payment.status, "paid": payment.paid_at is not None,
            "matrix_id": payment.matrix_id, "payment_id": payment.external_id}


def _find(db: Session, external_id: str | None, order_id: str | None) -> Payment | None:
    if order_id:
        exact = db.scalar(select(Payment).where(Payment.order_id == str(order_id)))
        if exact is not None:
            return exact
    if external_id:
        found = db.scalar(select(Payment).where(Payment.external_id == str(external_id)))
        if found is not None:
            return found
    payment_id = payments.payment_id_of(order_id)
    return db.get(Payment, payment_id) if payment_id else None


@router.post("/mock")
def pay_mock(payload: PaymentIn, db: Session = Depends(get_db)) -> dict:
    """Оплата без денег для стенда и тестов. Идёт тем же путём, что живая, только провайдер мок."""
    provider = payments.get("mock")
    if provider is None or not provider.enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Мок-оплата отключена")
    return {**_open(db, payload, provider), "mock": True}


@router.get("")
def listing(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """История платежей кабинета. Снимок тарифа лежит в самом платеже, поэтому смена цены
    задним числом историю не переписывает."""
    rows = db.scalars(select(Payment).where(Payment.user_id == user.id)
                      .order_by(Payment.id.desc())).all()
    return {"items": [row.item() for row in rows]}
