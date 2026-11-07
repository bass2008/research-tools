"""Бизнес-сообщения и независимые доставки в колокольчик. Без очереди писем."""
from __future__ import annotations

import datetime as dt
import json
import logging
import threading
import time
from types import SimpleNamespace
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from . import mail, sites
from .config import settings
from .i18n import current_locale, using_locale
from .db import SessionLocal, begin_write
from .models import Entitlement, Notification, NotificationDelivery, Purchase, Reading, User, as_utc, iso, utcnow
from .security import INDIVIDUAL_LINK_TTL, create_individual_token

log = logging.getLogger("arcana.notifications")
ADMIN_TYPE = "admin_payment_succeeded"


def emit(db: Session, kind: str, key: str, data: dict, recipients: list[int]) -> list[int]:
    """Вызывается внутри транзакции события. Возвращает только новые доставки."""
    nid = db.scalar(insert(Notification).values(type=kind, event_key=key,
        data=json.dumps(data, ensure_ascii=False), created_at=utcnow())
        .on_conflict_do_nothing(index_elements=["type", "event_key"]).returning(Notification.id))
    if nid is None:
        return []
    ids = []
    for uid in set(recipients):
        did = db.scalar(insert(NotificationDelivery).values(notification_id=nid, user_id=uid,
            delivered_at=utcnow()).on_conflict_do_nothing(index_elements=["notification_id", "user_id"])
            .returning(NotificationDelivery.id))
        if did is not None:
            ids.append(did)
    return ids


def context() -> dict:
    return {"site_origin": sites.current().origin, "locale": current_locale()}


def admin_ids(db: Session) -> list[int]:
    users = db.scalars(select(User).where(User.email.in_(settings.admins))).all()
    found = {u.email for u in users}
    if set(settings.admins)-found:
        log.warning("Не всем получателям admin_emails соответствуют аккаунты")
    return [u.id for u in users]


def grant_event(db: Session, user: User, right: Entitlement, reading=None, *, paid: bool = False,
                payment_id: int | None = None, extra: dict | None = None) -> list[int]:
    titles = {}
    if reading:
        for locale in ("ru", "en"):
            with using_locale(locale):
                titles[locale] = reading.label()
    data = {"titles": titles, **context(), "source": "purchase" if paid else "admin", "until": iso(right.expires_at),
            "reading_id": reading.id if reading else None, "product": reading.product if reading else None,
            "title": reading.label() if reading else None, **(extra or {})}
    kind = "reading_available" if right.per_reading else "subscription_active"
    key = f"payment:{payment_id}" if paid else f"grant:{right.id}"
    return emit(db, kind, key, data, [user.id])


def subscription_date(value: str | None, locale: str, time_zone: str | None) -> str:
    if not value:
        return ""
    # Email has no browser timezone; keep its existing date format.
    if time_zone is None:
        return value[:10]
    try:
        zone = ZoneInfo(time_zone)
    except (ZoneInfoNotFoundError, ValueError):
        zone = dt.timezone.utc
    date = as_utc(dt.datetime.fromisoformat(value.replace("Z", "+00:00"))).astimezone(zone)
    return date.strftime("%d/%m/%Y" if locale == "en" else "%d.%m.%Y")


def render(notification: Notification, locale: str, *, email: bool = False,
           admin: bool = False, user_id: int | None = None, time_zone: str | None = None) -> dict:
    en = locale == "en"
    d = json.loads(notification.data)
    pair = d.get("product") == "pair"
    product = ("Compatibility" if en else "Совместимость") if pair else ("Personal reading" if en else "Личный разбор")
    # Название разбора может содержать даты рождения: в письме только тип продукта.
    label = product if email else (d.get("titles", {}).get(locale) or d.get("title") or product)
    account = f"/admin/users/{user_id}" if admin and user_id else "/account"
    rid = d.get("reading_id")
    href = (f"/readings/{rid}" if pair else f"/matrices/{rid}") if rid else ("/compatibility" if pair else "/#calc")
    kind = notification.type
    if kind == "reading_available":
        if admin and rid:
            href = f"/admin/readings/{rid}"
        title = "Your reading is available" if en else "Разбор доступен"
        source = ("Purchased" if en else "Оплачен") if d.get("source") == "purchase" else ("Added by an administrator" if en else "Добавлен администратором")
        body = f"{label}. {source}."
        action = "Open reading" if en else "Открыть разбор"
    elif kind == "subscription_active":
        title = "Subscription active" if en else "Подписка активна"
        until = subscription_date(d.get("until"), locale, time_zone)
        body = (f"Access until {until}." if en else f"Доступ до {until}.") if until else ("Access has no expiry date." if en else "Бессрочный доступ.")
        if d.get("source") == "admin":
            body += " Granted by an administrator." if en else " Выдана администратором."
        if d.get("source") == "purchase":
            body += " Activated after purchase." if en else " Активирована после оплаты."
        href, action = account, "My readings" if en else "Мои разборы"
    elif kind == "subscription_expired":
        title = "Subscription expired" if en else "Подписка закончилась"
        body = ("Your subscription period has ended. Your separately purchased and granted readings retain their access." if en else
                "Срок подписки истёк. Отдельно оплаченные и выданные разборы сохраняют свой доступ.")
        body = (("Ended on " if en else "Закончилась ") + subscription_date(d.get("until"), locale, time_zone) + ". " + body)
        href, action = account, "My account" if en else "В кабинет"
    elif kind == "individual_reading_ready":
        title = "Your individual reading is ready" if en else "Ваш индивидуальный разбор готов"
        body = "Your personal article is ready to read." if en else "Ваша персональная статья готова. Приятного чтения!"
        href = f"/matrix/individual/{d['individual_id']}"
        action = "Open" if en else "Открыть"
    elif kind == "individual_order_accepted":
        months = (["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
                   "November", "December"] if en else
                  ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября",
                   "ноября", "декабря"])
        day = lambda iso: (lambda d: f"{months[d.month - 1]} {d.day}" if en else f"{d.day} {months[d.month - 1]}")(
            dt.date.fromisoformat(iso))
        title = "Your individual order is accepted" if en else "Заказ принят"
        parts = d.get("parts", {}).get(locale, "")
        body = (f"Individual readings: {parts}. Usually ready by {day(d['typical'])}, no later than {day(d['latest'])}. "
                "We will email you as soon as it is ready. The automatic readings of the same dates are already open."
                if en else
                f"Индивидуальный разбор: {parts}. Обычно готов к {day(d['typical'])}, не позже {day(d['latest'])}. "
                "Пришлём письмо, как только он будет готов. Автоматические разборы тех же дат уже открыты.")
        href = account if admin and user_id else "/account?filter=individual"
        action = "My readings" if en else "Мои разборы"
    elif kind == ADMIN_TYPE:
        title = "New successful payment" if en else "Новая успешная оплата"
        amount = f"{d.get('amount', 0)/100:.2f} {d.get('currency', 'RUB')}"
        body = f"{d.get('offer_name', '')} · {amount}\n{d.get('buyer_email', '')}\n" + (
            f"Payment {d.get('payment_id')} · Order {d.get('purchase_id')}" if en else
            f"Платёж {d.get('payment_id')} · Заказ {d.get('purchase_id')}")
        body += f"\n{d.get('site_origin', '')}\n{d.get('paid_at', '')}"
        href, action = "/admin#payments", "View payment" if en else "Посмотреть оплату"
    else:
        raise ValueError("Unknown business notification type")
    return {"title": title, "text": body, "action": {"label": action, "href": href}}


def deliver_emails(db: Session, ids: list[int]) -> int:
    """Только для впервые созданных доставок. Сбой письма не влияет на событие."""
    failed = 0
    for did in ids:
        try:
            delivery = db.get(NotificationDelivery, did)
            if not delivery or delivery.email_status is not None:
                continue
            note, user = delivery.notification, delivery.user
            if note.type == ADMIN_TYPE and not settings.is_admin(user.email):
                continue
            data = json.loads(note.data)
            locale = data.get("locale", "ru")
            recipient = user.email
            unverified = not user.email_verified_at
            paid = data.get("source") == "purchase"
            if paid:
                subscription = note.type == "subscription_active"
                reading = db.get(Reading, data["reading_id"]) if data.get("reading_id") else None
                reading_ref = SimpleNamespace(id=reading.id, product=reading.product) if reading else None
            else:
                body = render(note, locale, email=True)
                text = body["text"] + f"\n\n{body['action']['label']}: {mail.link_origin(data.get('site_origin'))}/{locale}{body['action']['href']}"
                if note.type == "individual_reading_ready":
                    token = create_individual_token("individual_reading", data["individual_id"], user.id,
                                                    INDIVIDUAL_LINK_TTL)
                    text += f"#token={token}"
                    text += "\n\n" + ("This link is valid for 30 days." if locale == "en" else "Ссылка действует 30 дней.")
            # Release the DB transaction before waiting for SMTP/Postbox.
            db.commit()
            if paid:
                with using_locale(locale):
                    ok = mail.purchase(recipient, data.get("offer_name", ""), data.get("external_id", ""),
                        reading=reading_ref, subscription=subscription, verify_email=unverified,
                        origin=data.get("site_origin"))
            else:
                ok = mail.send(recipient, body["title"], text)
            delivery = db.get(NotificationDelivery, did)
            if not ok:
                log.warning("Письмо не отправлено delivery_id=%s", did)
            delivery.email_status = "sent" if ok else "failed"
            failed += int(not ok)
            db.commit()
        except Exception:
            db.rollback()
            failed += 1
            log.exception("Ошибка письма delivery_id=%s", did)
            try:
                delivery = db.get(NotificationDelivery, did)
                if delivery:
                    delivery.email_status = "failed"
                    db.commit()
            except Exception:
                db.rollback()
                log.exception("Не сохранён результат письма delivery_id=%s", did)
    return failed


def expiration_events(db: Session, since: dt.datetime, now: dt.datetime | None = None) -> list[int]:
    now = now or utcnow()
    rows = db.scalars(select(Entitlement).where(Entitlement.per_reading.is_(False),
        Entitlement.revoked_at.is_(None)).order_by(Entitlement.user_id, Entitlement.starts_at, Entitlement.id)).all()
    grouped: dict[int, list[Entitlement]] = {}
    for r in rows:
        grouped.setdefault(r.user_id, []).append(r)
    deliveries = []
    for uid, rights in grouped.items():
        if any(r.active(now) for r in rights):
            continue
        # Объединяем пересекающиеся/соседние интервалы; каждое фактическое окончание один раз.
        intervals: list[tuple[dt.datetime, dt.datetime, Entitlement]] = []
        for r in rights:
            if r.expires_at is None:
                continue
            start, end = as_utc(r.starts_at), as_utc(r.expires_at)
            if intervals and start <= intervals[-1][1]:
                prev = intervals[-1]
                if end > prev[1]:
                    intervals[-1] = (prev[0], end, r)
            else:
                intervals.append((start, end, r))
        for _, end, right in intervals:
            if not since <= end <= now:
                continue
            # Источник сайта у покупки; у выдачи — сохранённое уведомление о выдаче.
            if right.purchase_id:
                purchase = db.get(Purchase, right.purchase_id)
                data = purchase.body() if purchase else {}
            else:
                origin = db.scalar(select(Notification).where(Notification.type == "subscription_active",
                    Notification.event_key == f"grant:{right.id}"))
                data = json.loads(origin.data) if origin else {}
            deliveries += emit(db, "subscription_expired", f"user:{uid}:until:{end.isoformat()}",
                {"until": end.isoformat(), "locale": data.get("locale", "ru")}, [uid])
    return deliveries


CHECK_ZONE = ZoneInfo("Europe/Moscow")
CHECK_HOUR = 12
# Missed days (a restart, a deploy) are covered by the window; events are unique, so overlaps are free.
CHECK_WINDOW = dt.timedelta(days=3)


def check_expirations(db: Session, now: dt.datetime | None = None) -> dict:
    now = now or utcnow()
    since = now - CHECK_WINDOW
    if settings.notification_check_since:
        since = max(since, as_utc(dt.datetime.fromisoformat(settings.notification_check_since.replace("Z", "+00:00"))))
    begin_write(db)
    ids = expiration_events(db, since, now)
    db.commit()
    return {"created": len(ids), "email_errors": deliver_emails(db, ids)}


def seconds_to_next_check(now: dt.datetime | None = None) -> float:
    local = (now or utcnow()).astimezone(CHECK_ZONE)
    target = local.replace(hour=CHECK_HOUR, minute=0, second=0, microsecond=0)
    if target <= local:
        target += dt.timedelta(days=1)
    return (target - local).total_seconds()


def start() -> threading.Thread:
    def loop() -> None:
        while True:
            time.sleep(seconds_to_next_check())
            try:
                with SessionLocal() as db:
                    log.info("проверка окончаний подписок: %s", check_expirations(db))
            except Exception:                      # noqa: BLE001
                log.exception("проверка окончаний подписок упала")

    thread = threading.Thread(target=loop, name="notifications", daemon=True)
    thread.start()
    return thread
