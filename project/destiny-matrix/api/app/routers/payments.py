from __future__ import annotations

import datetime as dt
import json
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..i18n import say, say_for, current_locale, using_locale
from .. import access, mail, offers, payments, printing, products, readings, sites
from ..http_errors import LocalizedHTTPException
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import Entitlement, Offer, Payment, Purchase, Reading, User, as_utc, utcnow
from ..schemas import PaymentIn, PaymentRef
from ..payments.base import PaymentUrls
from ..payments.notification_log import notification_log
from urllib.parse import urlencode
from ..security import create_token, hash_password, random_password

router = APIRouter(prefix="/payments", tags=["payments"])


def _reading_for(db: Session, user: User, payload: PaymentIn, offer: Offer) -> Reading:
    """За какой разбор платят. Разовое предложение без цели не продаётся: право, которому не к
    чему прилипнуть, оставляет человека с оплатой и без разбора."""
    product = products.PRODUCTS[offer.product_list()[0]]
    wanted = payload.reading_id if payload.reading_id is not None else payload.matrix_id
    if wanted is not None:
        row = readings.own(db, user, wanted, product.code)
    elif payload.inputs is not None:
        # тот же ввод второй раз — та же запись: платёж не должен плодить дубли
        row = readings.create(db, user, product, payload.inputs, limited=False)
    elif payload.birth is not None and product.code == products.PERSONAL:
        row = readings.create(db, user, product, {"birth": payload.birth, "sex": payload.sex or "f"},
                              limited=False)
    else:
        # разбор могли сохранить до оплаты: платят за последний, который ещё закрыт
        rows = db.scalars(select(Reading).where(Reading.user_id == user.id,
                                                Reading.product == product.code)
                          .order_by(Reading.id.desc())).all()
        row = next((r for r in rows if not access.can_open(db, user, r)), None)
        if row is None:
            raise LocalizedHTTPException(status.HTTP_400_BAD_REQUEST,
                                         detail=lambda: say_for("pay.target_required", product.code))
    return row


def _refuse_held(db: Session, user: User, offer: Offer, reading: Reading | None) -> None:
    """Уже открытое не продаём. Две открытые формы или двойной клик давали два прошедших платежа
    за один разбор, а вторая подписка не продлевала срок — новое право считается от сегодня."""
    covering = access.covering(access.active_rights(db, user), offer.body(), reading)
    if not covering:
        return
    if reading is not None:
        raise LocalizedHTTPException(status.HTTP_409_CONFLICT,
                                     detail=lambda: say_for("pay.already_open", reading.product))
    ends = [r.expires_at for r in covering if r.expires_at is not None]
    until = products.date_label(max(ends).date().isoformat()) if len(ends) == len(covering) else None
    raise LocalizedHTTPException(
        status.HTTP_409_CONFLICT,
        detail=lambda: say("pay.subscription_active", until=until) if until else say("pay.subscription_forever"))


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
            raise LocalizedHTTPException(status.HTTP_400_BAD_REQUEST,
                                detail=lambda: say("pay.user_failed")) from None
        return user, False
    return user, True


def _offer(db: Session, code: str) -> Offer:
    """Предложение канала этого запроса. Цену из браузера не берём никогда: браузер присылает
    код, цена — из базы."""
    offer = offers.get(db, code)
    if offer is None or offer.channel != offers.channel():
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("pay.no_tariff"))
    return offer


class AlreadyGranted(Exception):
    """Право на этот разбор уже есть, и выдано оно не этим заказом.

    Отдельное исключение, а не сразу `HTTPException`: браузеру нужен отказ (человек не должен
    платить дважды), а уведомлению провайдера — приём, иначе он повторяет доставку до упора.
    Решает это вызывающий, а не место, где обнаружен дубль.
    """

    def __init__(self, right: Entitlement) -> None:
        super().__init__("право на этот разбор уже выдано")
        self.right = right


def _active_right(db: Session, purchase: Purchase) -> Entitlement | None:
    """Действующее право на тот же разбор, кем бы оно ни было выдано."""
    if purchase.reading_id is None:
        return None
    return db.scalar(select(Entitlement).where(Entitlement.user_id == purchase.user_id,
                                               Entitlement.reading_id == purchase.reading_id,
                                               Entitlement.revoked_at.is_(None)))


def _grant_once(db: Session, purchase: Purchase, now: dt.datetime) -> tuple[Entitlement, bool]:
    """Право на заказ выдаётся один раз: провайдер сообщает об оплате несколько раз и повторяет
    уведомление, пока не получит подтверждение приёма.

    Своё право ищется по заказу, чужое — по паре «человек и разбор»: именно она уникальна в базе
    (`ux_entitlement_active_reading`). Заказ защищён `ux_entitlement_active_purchase`,
    в том числе подписка без reading_id. Без второй проверки повтор уведомления и второй
    заказ на тот же разбор шли вставлять запись и падали на индексе уже внутри `access.grant`.
    """
    right = db.scalar(select(Entitlement).where(Entitlement.purchase_id == purchase.id))
    if right is not None:
        return right, False
    existing = _active_right(db, purchase)
    if existing is not None:
        raise AlreadyGranted(existing)
    user = db.get(User, purchase.user_id)
    purchase.paid_at = purchase.paid_at or now
    try:
        return access.grant(db, user, purchase.body(), purchase=purchase,
                            reading_id=purchase.reading_id, now=now), True
    except IntegrityError:
        # Проверка выше не ловит гонку: два уведомления об одном платеже приходят одновременно,
        # оба видят пустоту и оба идут вставлять. Ловит уникальный индекс — на нём и разбираемся.
        db.rollback()
        db.refresh(purchase)
        winner = db.scalar(select(Entitlement).where(Entitlement.purchase_id == purchase.id))
        if winner is not None:
            return winner, False
        existing = _active_right(db, purchase)
        if existing is None:
            raise
        raise AlreadyGranted(existing) from None


def apply(db: Session, payment: Payment, update: payments.Update) -> Payment:
    """Единственное место, где исход платежа превращается в права. Названия статусов сюда не
    доходят — провайдер отдаёт нормализованный исход."""
    now = utcnow()
    purchase = payment.purchase
    payment.status = update.status or payment.status
    outcome = update.outcome
    if outcome is payments.Outcome.CANCELED:
        # деньги уже списаны — значит это возврат, иначе просто снятый холд
        outcome = (payments.Outcome.REFUNDED if payment.paid_at is not None
                   else payments.Outcome.FAILED)
    if outcome is payments.Outcome.PAID:
        payment.paid_at = payment.paid_at or now
        right, fresh = _grant_once(db, purchase, now)
        db.commit()
        if fresh:
            body = purchase.body()
            with using_locale(body.get("locale", "ru")), sites.using_site(sites.payment_site(payment)):
                mail.purchase(payment.user.email, body.get("display_name", body["name"]),
                              payment.external_id, reading=purchase.reading,
                              subscription=not body.get("per_reading", True))
            # печать начинается сразу, не дожидаясь нажатия: на слабой машине она идёт десятки
            # секунд, и человеку незачем их ждать. Нажал раньше времени — запрос дождётся этой же
            # печати, второго рендера не будет.
            with using_locale(body.get("locale", settings.site_lang)):
                printing.warm(payment.user_id, purchase.reading_id)
    elif outcome is payments.Outcome.REFUNDED:
        first = payment.refunded_at is None
        payment.refunded_at = payment.refunded_at or now
        # заказ возвращён, только если вернули ту попытку, которой он оплачен
        if payment.paid_at is not None:
            purchase.refunded_at = purchase.refunded_at or now
            for right in db.scalars(select(Entitlement)
                                    .where(Entitlement.purchase_id == purchase.id)).all():
                right.revoked_at = right.revoked_at or now
        db.commit()
        if first and payment.paid_at is not None:
            body = purchase.body()
            with using_locale(body.get("locale", settings.site_lang)):
                mail.refund(payment.user.email, body.get("display_name", body["name"]), payment.external_id,
                            access.refund_outcome(db, purchase, done=True))
    else:
        db.commit()
    db.refresh(payment)
    return payment


def _provider_of(payment: Payment) -> payments.Provider:
    provider = payments.for_payment(payment)
    if provider is None or not provider.enabled():
        raise LocalizedHTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail=lambda: say("pay.provider_down"))
    return provider


def _open_purchase(db: Session, user: User, offer: Offer, reading: Reading | None,
                   connection: sites.Connection) -> Purchase | None:
    """Начатый, но не оплаченный заказ того же разбора с этой же страницы: две открытые вкладки
    оплаты или повтор после отказа карты не должны превращаться в два заказа."""
    if reading is None:
        return None
    rows = db.scalars(
        select(Purchase).where(Purchase.user_id == user.id, Purchase.reading_id == reading.id,
                               Purchase.offer_id == offer.id, Purchase.paid_at.is_(None),
                               Purchase.refunded_at.is_(None))
        .order_by(Purchase.id.desc()).limit(5)
    ).all()
    for row in rows:
        attempt = row.last_payment()
        if (attempt is None or sites.payment_connection(attempt) != connection
                or sites.payment_site(attempt) != sites.current()
                or row.body().get("locale", "ru") != current_locale()):
            continue
        if (utcnow() - as_utc(row.created_at)).total_seconds() > settings.payment_reuse_seconds:
            continue
        return row
    return None


def _reusable(db: Session, purchase: Purchase, provider: payments.Provider) -> Payment | None:
    """Живая попытка заказа: человек возвращается к уже выставленному счёту, а не получает второй.
    На живом терминале без этой проверки выходило два платежа по одной дате."""
    rows = [p for p in reversed(purchase.payments)
            if p.provider == provider.name and p.paid_at is None and p.refunded_at is None
            and p.order_id and p.pay_url][:5]
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
        except AlreadyGranted:
            db.rollback()
            continue                               # разбор уже открыт: доплачивать нечего
        if row.paid_at is None and row.refunded_at is None and provider.reusable(row.status):
            return row
    return None


def _body(db: Session, payment: Payment, user: User, reading: Reading | None,
          offer: Offer, order: str, autoregistered: bool) -> dict:
    right = db.scalar(select(Entitlement).where(Entitlement.purchase_id == payment.purchase_id))
    item = reading.item() if reading else None
    body = {"ok": True, "order_id": order, "payment_id": payment.external_id,
            "payment_url": payment.pay_url, "status": payment.status,
            "paid": payment.paid_at is not None, "state": payment.state(),
            "provider": payment.provider, "purchase_id": payment.purchase_id,
            "user": user.public(), "autoregistered": autoregistered,
            "tariff": offer.public_body(), "entitlement": right.item() if right else None,
            "reading_id": reading.id if reading else None, "reading": item,
            "matrix_id": reading.id if reading else None, "matrix": item}
    # Токен выдаём только вместе с автосозданием аккаунта: иначе достаточно знать чужую почту,
    # чтобы «купить» и попасть в чужой кабинет.
    body["token"] = create_token(user.id, user.password_hash) if autoregistered else None
    if not autoregistered:
        body["requires_login"] = True
    return body


def _open(db: Session, payload: PaymentIn, connection: sites.Connection) -> dict:
    """Один путь для всех способов оплаты и всех продуктов: покупатель, разбор, заказ, попытка,
    обращение к провайдеру и применение исхода. Права выдаёт только apply(), поэтому мок и живой
    банк не расходятся."""
    # Витрина без оплаты: продавать нечего, разбор и так открыт. Проверка стоит в общей точке,
    # а не в маршрутах, — иначе мок и живой банк разошлись бы поведением.
    if settings.all_free_without_payment:
        raise LocalizedHTTPException(status.HTTP_409_CONFLICT,
                            detail=lambda: say("pay.all_free"))
    site = sites.current()
    provider = payments.get(connection.provider)
    offer = _offer(db, payload.tariff)
    user, autoregistered = _buyer(db, payload.email)
    reading = _reading_for(db, user, payload, offer) if offer.per_reading else None
    _refuse_held(db, user, offer, reading)

    purchase = _open_purchase(db, user, offer, reading, connection)
    if purchase is not None:
        attempt = _reusable(db, purchase, provider)
        if attempt is not None:
            db.commit()
            return _body(db, attempt, user, reading, offer, attempt.order_id or "", autoregistered)
    else:
        body = {**offer.body(), "locale": current_locale(),
                "display_name": offer.public_body()["name"],
                "site_origin": site.origin, "connection_id": connection.id}
        purchase = Purchase(user_id=user.id, offer_id=offer.id,
                            offer_body=json.dumps(body, ensure_ascii=False),
                            reading_id=reading.id if reading else None, amount=offer.price,
                            currency=offer.currency, channel=offer.channel)
        db.add(purchase)
        db.flush()

    payment = Payment(user_id=user.id, purchase_id=purchase.id, amount=purchase.amount,
                      external_id=f"new-{uuid.uuid4().hex[:24]}", provider=provider.name,
                      status="NEW")
    db.add(payment)
    db.flush()

    order = payments.order_id(payment.id)
    query = urlencode({"order": order})
    urls = PaymentUrls(success=f"{site.origin}/{current_locale()}/pay/done?{query}",
                       fail=f"{site.origin}/{current_locale()}/pay/fail?{query}",
                       notification=connection.notification_url)
    try:
        started = provider.start(order, purchase.amount, purchase.body()["name"], user.email, urls=urls)
    except payments.PaymentError as exc:
        db.rollback()
        raise LocalizedHTTPException(status.HTTP_502_BAD_GATEWAY, detail=exc.public_message) from exc

    payment.external_id = started.external_id
    payment.pay_url = started.pay_url
    payment.status = started.status
    payment.order_id = order
    db.flush()
    try:
        apply(db, payment, payments.Update(external_id=started.external_id, order_id=order,
                                           outcome=started.outcome, status=started.status))
    except AlreadyGranted as exc:
        db.rollback()
        code = offer.product_list()[0] if offer.per_reading else None
        raise LocalizedHTTPException(status.HTTP_409_CONFLICT,
                            detail=lambda: say_for("pay.already_open_dot", code)) \
            from exc
    db.refresh(user)

    return _body(db, payment, user, reading, offer, order, autoregistered)


@router.post("/start")
def start(payload: PaymentIn, db: Session = Depends(get_db)) -> dict:
    return _open(db, payload, payments.select_connection(payload.provider))


@router.post("/notify/{provider_name}")
def notify(provider_name: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    """Уведомление провайдера. Подлинность проверяет он сам: без неё доступ открывал бы любой."""
    with notification_log(provider_name, payload) as event:
        connection = sites.connection_by_id(provider_name)
        site = sites.current()
        if (connection is None or connection not in site.payments
                or connection.notification_url != f"{site.origin}/api/payments/notify/{provider_name}"):
            event["result"] = "provider_unavailable"
            raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("pay.no_method"))
        provider = payments.get(connection.provider)
        if provider is None or not provider.enabled():
            event["result"] = "provider_unavailable"
            raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("pay.no_method"))
        try:
            update = provider.read_notification(payload)
        except payments.PaymentError as exc:
            event["signature_valid"] = False
            event["result"] = "invalid_signature"
            raise LocalizedHTTPException(status.HTTP_403_FORBIDDEN, detail=exc.public_message) from exc
        event["signature_valid"] = True
        payment = _find(db, update.external_id, update.order_id)
        if (payment is None or sites.payment_connection(payment) != connection
                or (update.external_id and update.external_id != payment.external_id)
                or (update.order_id and update.order_id != payment.order_id)):
            event["result"] = "payment_not_found"
            raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("pay.not_found"))
        event["payment_id"] = payment.id
        event["status_before"] = payment.status
        try:
            apply(db, payment, update)
        except AlreadyGranted:
            # Провайдер повторяет доставку, пока не получит приём. Отказ на дубль он считает
            # недоставкой и шлёт снова — а состояние уже конечное, повторы ничего не изменят.
            db.rollback()
            db.refresh(payment)
            event.update(result="duplicate", status_after=payment.status)
            return {"ok": True, "status": payment.status, "duplicate": True}
        event.update(result="applied", status_after=payment.status)
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
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("pay.not_found"))
    provider = payments.for_payment(payment)
    if (provider is not None and provider.enabled()
            and sites.payment_connection(payment) in sites.current().payments):
        try:
            apply(db, payment, provider.state(payment.external_id))
        except payments.PaymentError as exc:
            raise LocalizedHTTPException(status.HTTP_502_BAD_GATEWAY, detail=exc.public_message) from exc
        except AlreadyGranted:
            # Доступ у человека есть, спрашивал он именно про него: это не ошибка, а ответ.
            db.rollback()
            db.refresh(payment)
    purchase = payment.purchase
    reading = purchase.reading
    body = {"ok": True, "status": payment.status, "state": payment.state(),
            "paid": payment.paid_at is not None,
            "reading_id": payment.reading_id, "matrix_id": payment.reading_id,
            "product": reading.product if reading else None,
            "payment_id": payment.external_id,
            "tariff": purchase.offer_id,
            # подписка без разбора: чек говорит про подписку, а не «разбор сохранён в кабинете»
            "subscription": not purchase.body().get("per_reading", True),
            "until": access.summary(db, user)["until"]}
    if payment.state() == "refunded":
        # чек возврата говорит то же, что окно возврата и письмо: доступ мог остаться
        key, _, _ = access.after_refund(db, purchase)
        body["outcome"] = access.refund_outcome(db, purchase, done=True)
        body["still_open"] = key not in access.CLOSED_AFTER_REFUND
    return body


def _find(db: Session, external_id: str | None, order_id: str | None) -> Payment | None:
    if order_id:
        exact = db.scalar(select(Payment).where(Payment.order_id == str(order_id)))
        if exact is not None:
            return exact
    if external_id:
        found = db.scalar(select(Payment).where(Payment.external_id == str(external_id)))
        if found is not None:
            return found
    return None


@router.post("/mock")
def pay_mock(payload: PaymentIn, db: Session = Depends(get_db)) -> dict:
    """Оплата без денег для стенда и тестов. Идёт тем же путём, что живая, только провайдер мок."""
    connection = payments.select_connection(payload.provider or "mock")
    if connection.provider != "mock":
        raise LocalizedHTTPException(status.HTTP_403_FORBIDDEN, detail=lambda: say("pay.mock_off"))
    return {**_open(db, payload, connection), "mock": True}


@router.get("")
def listing(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """История покупок кабинета: строка на заказ, сколько бы попыток оплаты в нём ни было.
    Снимок предложения лежит в самом заказе, поэтому смена цены задним числом историю не
    переписывает."""
    rows = db.scalars(select(Purchase).where(Purchase.user_id == user.id)
                      .order_by(Purchase.id.desc())).all()
    return {"items": [row.item() for row in rows]}
