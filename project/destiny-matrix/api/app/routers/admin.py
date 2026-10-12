"""Админка: кто зарегистрирован, когда заходил, что купил и какие даты сохранил."""
from __future__ import annotations

import json
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import access, audit, monitor, offers, printing, products, readings
from .. import reports as report_store
from .. import payments as gateway
from ..routers.payments import apply as apply_payment
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..i18n import using_locale, say, validation_message
from ..http_errors import LocalizedHTTPException
from ..models import (Payment, PaymentSweep, Purchase, Reading, ReportJob, SecurityAudit,
                      User, MetrikaClient, iso)
from ..schemas import BirthIn, ReadingIn
from ..security import create_token

router = APIRouter(prefix="/admin", tags=["admin"])
log = logging.getLogger("admin")


def admin_user(user: User = Depends(current_user)) -> User:
    if not settings.is_admin(user.email):
        # 404, а не 403: существование админских адресов посторонним знать незачем
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("admin.not_found"))
    return user


def _row(db: Session, user: User) -> dict:
    rights = access.active_rights(db, user)
    paid = db.execute(
        select(func.count(Purchase.id), func.coalesce(func.sum(Purchase.amount), 0))
        .where(Purchase.user_id == user.id, Purchase.paid_at.is_not(None),
               Purchase.refunded_at.is_(None))
    ).one()
    summary = access.summary(db, user)
    return {
        "id": user.id,
        "email": user.email,
        "created_at": iso(user.created_at),
        "last_seen_at": iso(user.last_seen_at),
        "is_admin": settings.is_admin(user.email),
        "matrices": access.saved_count(db, user),
        "payments": int(paid[0]),
        "spent": int(paid[1]),
        "scopes": summary["scopes"],
        "owned": summary["owned"],
        "granted": summary["granted"],
        "until": summary["until"],
        "rights": len(rights),
        "products": summary["products"],
        "holdings": summary["holdings"],
    }


# last_seen_at reaches the DB with the hourly presence flush; until then registration is the
# latest appearance, otherwise a fresh buyer sinks to the bottom of the list.
USER_COLUMNS = {"id": User.id, "email": User.email,
                "last_seen_at": func.coalesce(User.last_seen_at, User.created_at),
                "created_at": User.created_at}
# Counted per row, so these sort the computed rows rather than SQL.
USER_COMPUTED = {"matrices": lambda r: r["matrices"], "payments": lambda r: r["payments"],
                 "spent": lambda r: r["spent"],
                 "access": lambda r: (r["rights"], len(r["holdings"]))}


@router.get("/users")
def users(page: int = 1, page_size: int = 10,
          sort: Literal["id", "email", "matrices", "payments", "spent", "access",
                        "last_seen_at", "created_at"] = "last_seen_at",
          order: Literal["asc", "desc"] = "desc",
          _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    page = max(1, page)
    page_size = min(max(page_size, 1), 200)
    total = db.scalar(select(func.count(User.id))) or 0
    start = (page - 1) * page_size
    if sort in USER_COMPUTED:
        rows = [_row(db, u) for u in db.scalars(select(User).order_by(User.id.desc())).all()]
        rows.sort(key=USER_COMPUTED[sort], reverse=order == "desc")
        items = rows[start:start + page_size]
    else:
        column = USER_COLUMNS[sort]
        direction = column.desc() if order == "desc" else column.asc()
        found = db.scalars(select(User).order_by(direction.nulls_last(), User.id.desc())
                           .offset(start).limit(page_size)).all()
        items = [_row(db, u) for u in found]
    return {"items": items, "total": int(total), "page": page, "page_size": page_size,
            "sort": sort, "order": order}


@router.get("/payments")
def payments(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Все платежи с почтой плательщика: в кабинете видны только свои."""
    rows = db.execute(
        select(Payment, User.email).join(User, User.id == Payment.user_id)
        .order_by(Payment.id.desc())
    ).all()
    found = {r.id: r.item() for r in db.scalars(select(Reading)).all()}
    return {"items": [{**payment.item(), "user_id": payment.user_id, "email": email,
                       "reading": found.get(payment.reading_id),
                       "matrix": found.get(payment.reading_id)}
                      for payment, email in rows]}


@router.get("/payments/{payment_id}/refund-preview")
def refund_preview(payment_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Что станет с доступом после возврата — текст для окна подтверждения."""
    payment = db.get(Payment, payment_id)
    if payment is None or payment.purchase is None:
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("pay.not_found"))
    return {"outcome": access.refund_outcome(db, payment.purchase)}


@router.post("/payments/{payment_id}/refund")
def refund(payment_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Отмена платежа: до списания это отмена, после — возврат. Права снимаются по уведомлению
    банка, но статус применяем сразу, чтобы доступ не оставался открытым до его прихода."""
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("pay.not_found"))
    # Возврат идемпотентен: повторное нажатие отдаёт текущее состояние, а не ошибку. Иначе
    # устаревшая вкладка получала отказ банка «уже возвращён», а строка оставалась «оплачен» с
    # живой кнопкой — интерфейс уверял, что деньги на месте, хотя они уже вернулись.
    if payment.refunded_at is not None:
        return {"ok": True, "status": payment.status, "refunded_at": iso(payment.refunded_at),
                "already": True}
    provider = gateway.for_payment(payment)
    if provider is None or not provider.enabled():
        raise LocalizedHTTPException(status.HTTP_400_BAD_REQUEST, detail=lambda: say("admin.cancel_unavailable"))
    try:
        update = provider.cancel(payment.external_id)
    except gateway.PaymentError as exc:
        raise LocalizedHTTPException(status.HTTP_502_BAD_GATEWAY, detail=exc.public_message) from exc
    apply_payment(db, payment, update)
    return {"ok": True, "status": payment.status, "refunded_at": iso(payment.refunded_at)}


@router.get("/reports")
def reports(page: int = 1, page_size: int = 10,
            _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Очередь печати: что печатали, сколько это заняло и что упало. Клиенту она не видна —
    для него запрос синхронный.

    Строки отдаются страницей, а сводка считается по всей очереди: «сколько упало» про очередь
    целиком, а не про десять последних записей."""
    printing.expire_stale(db)
    page = max(1, page)
    page_size = min(max(page_size, 1), 200)
    rows = db.execute(
        select(ReportJob, User.email).join(User, User.id == ReportJob.user_id)
        .order_by(ReportJob.id.desc())
    ).all()
    running = sum(1 for job, _e in rows if job.status == "running")
    done = [job.seconds() for job, _e in rows if job.status == "done" and job.seconds()]
    page_rows = rows[(page - 1) * page_size:(page - 1) * page_size + page_size]
    # Check only the visible page, not every object in the report history.
    for job, _email in page_rows:
        printing.available(db, job)
    return {
        "items": [{**job.item(), "user_id": job.user_id, "email": email}
                  for job, email in page_rows],
        "total": len(rows),
        "page": page,
        "page_size": page_size,
        "running": running,
        "failed": sum(1 for job, _e in rows if job.status == "failed"),
        # среднее время печати: по нему видно, хватает ли машине процессора
        "avg_seconds": round(sum(done) / len(done), 1) if done else None,
        # сколько печатей идёт прямо сейчас и сколько мест всего: печать ограничена по памяти
        "printing_now": printing.active(),
        "print_slots": settings.print_slots,
        "warming": printing.pending(),
    }


@router.get("/sweeps")
def sweeps(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Прогоны досверки платежей: когда, сколько заявок опрошено и что изменилось."""
    rows = db.scalars(select(PaymentSweep).order_by(PaymentSweep.id.desc()).limit(50)).all()
    return {"items": [row.item() for row in rows]}


@router.get("/users/{user_id}")
def one(user_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Карточка пользователя: его разборы и его платежи."""
    user = db.get(User, user_id)
    if user is None:
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("admin.no_user"))
    rights = access.active_rights(db, user)
    rows = db.scalars(
        select(Reading).where(Reading.user_id == user.id).order_by(Reading.id.desc())
    ).all()
    payment_rows = db.scalars(
        select(Payment).where(Payment.user_id == user.id).order_by(Payment.id.desc())
    ).all()
    items = {r.id: {**r.item(), **access.reading_state(rights, r)} for r in rows}
    return {
        "user": _row(db, user),
        "readings": list(items.values()),
        # прежний список личных дат
        "matrices": [item for item in items.values() if item["product"] == products.PERSONAL],
        "payments": [{**p.item(), "reading": items.get(p.reading_id), "matrix": items.get(p.reading_id)}
                     for p in payment_rows],
        "rights": [r.item() for r in rights],
        "reports": [job.item() for job in db.scalars(
            select(ReportJob).where(ReportJob.user_id == user.id)
            .order_by(ReportJob.id.desc())).all()],
    }


@router.post("/users/{user_id}/impersonate")
def impersonate(user_id: int, request: Request, admin: User = Depends(admin_user),
                db: Session = Depends(get_db)) -> dict:
    """Войти под пользователем, чтобы увидеть сайт его глазами.

    Права у сессии те же, что у самого человека, поэтому дальше админ — обычный посетитель с его
    корзиной прав; вернуться к себе можно только повторным входом. Токен помечен как чужой:
    присутствие такой сессии не записывается покупателю. Запись в журнале безопасности
    обязательна: вход под чужим аккаунтом обязан быть виден, и в списке он должен отличаться от
    настоящего входа этого человека.
    """
    target = db.get(User, user_id)
    if target is None:
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("admin.no_user"))
    audit.record("impersonate", "success", email=target.email, ip=audit.client_ip(request))
    log.info("админ %s вошёл под %s", admin.email, target.email)
    # Сессия помечена как чужая: она не двигает «последнее появление» покупателя (см. pulse).
    return {"token": create_token(target.id, target.password_hash, ghost=True),
            "user": target.public()}


def _grant(db: Session, user: User, product: products.Product, raw: dict) -> dict:
    """Выдать разбор без оплаты: открыт, но правом без заказа.

    Право бессрочное и без `purchase_id` — по этому признаку кабинет показывает разбор открытым, но
    не купленным (`access.reading_state`). Повторная выдача того же ввода ничего не ломает: разбор
    находится по вводу, а право не задваивается.
    """
    row = readings.create(db, user, product, raw, limited=False)
    db.commit()
    body = {"products": [product.code], "per_reading": True}
    fresh = not access.covering(access.granted(access.active_rights(db, user)), body, row, forever=True)
    if fresh:
        access.grant(db, user, body, reading_id=row.id, note="выдана админом")
        db.commit()
        printing.warm(user.id, row.id)
    return {**row.item(), **access.reading_state(access.active_rights(db, user), row), "granted_now": fresh}


def _user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("admin.no_user"))
    return user


@router.post("/users/{user_id}/matrices")
def add_matrix(user_id: int, payload: BirthIn, _: User = Depends(admin_user),
               db: Session = Depends(get_db)) -> dict:
    """Выдать личный разбор без оплаты — прежний адрес."""
    return _grant(db, _user_or_404(db, user_id), products.PRODUCTS[products.PERSONAL],
                  {"birth": payload.birth, "sex": payload.sex})


@router.post("/users/{user_id}/readings")
def add_reading(user_id: int, payload: ReadingIn, _: User = Depends(admin_user),
                db: Session = Depends(get_db)) -> dict:
    """Выдать разбор любого включённого продукта без оплаты: так принимают продукт на тестовом
    контуре, где мок-оплаты нет."""
    return _grant(db, _user_or_404(db, user_id), readings.product_or_404(payload.product),
                  payload.inputs)


@router.post("/users/{user_id}/subscription")
def add_subscription(user_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Выдать подписку без оплаты: те же продукты, хранение и срок, что у предложения `month`.
    Пока действует такая же выданная подписка, вторая не выдаётся — повторное нажатие ничего не
    меняет. Оплаченная не в счёт: выданная переживает её возврат."""
    user = _user_or_404(db, user_id)
    offer = offers.get(db, offers.MONTH_ID)
    if offer is None:
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("pay.no_tariff"))
    body = offer.body()
    current = access.covering(access.granted(access.active_rights(db, user)), body)
    if not current:
        access.grant(db, user, body, note="выдана админом")
        db.commit()
    summary = access.summary(db, user)
    return {"ok": True, "already": bool(current), "until": summary["until"],
            "products": summary["products"]}


@router.get("/reports/{job_id}/link")
def report_link(job_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Ссылка на готовый PDF любого пользователя: проверить, что человек получил именно то, за
    что заплатил. Ссылка подписана на час — та же, что получает покупатель."""
    job = db.get(ReportJob, job_id)
    if job is None:
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("admin.no_job"))
    if job.status == "expired" or (job.status == "done" and not printing.available(db, job)):
        raise LocalizedHTTPException(status.HTTP_410_GONE, detail=lambda: say("admin.file_expired"))
    if job.status != "done" or not job.object_key:
        raise LocalizedHTTPException(status.HTTP_409_CONFLICT, detail=lambda: say("admin.no_file"))
    row = db.get(Reading, job.reading_id)
    with using_locale(job.locale):
        name = (f"{products.PRODUCTS[row.product].default_title(row.data())}.pdf".replace("/", "-")
                if row else None)
    return {"url": report_store.link(job.object_key, name)}


@router.post("/reports/{job_id}/rebuild")
def report_rebuild(job_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Напечатать разбор заново. Готовый файл отдаётся из хранилища и сам не обновляется: если в
    нём оказалось не то — печать шла не с того контура, разбор с тех пор поправили, — заменить его
    было нечем, кроме как руками на машине."""
    job = db.get(ReportJob, job_id)
    if job is None:
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("admin.no_job"))
    try:
        with using_locale(job.locale), printing.exclusive(job.user_id, job.reading_id):
            fresh = printing.run(db, job.user_id, job.reading_id)
    except printing.Busy as exc:
        raise LocalizedHTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=lambda: say("admin.print_busy")) from exc
    except Exception as exc:                       # noqa: BLE001
        log.exception("Report rebuild failed")
        raise LocalizedHTTPException(status.HTTP_502_BAD_GATEWAY,
                                     detail=lambda: say("admin.print_failed")) from exc
    return {"job_id": fresh.id, "status": fresh.status, "size_bytes": fresh.size_bytes,
            "seconds": fresh.seconds()}


@router.get("/pulse")
def pulse(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Состояние машины и продукта сейчас. Нужна отдельно от облачного мониторинга: когда до
    консоли не добраться, это единственное место, где видно, что происходит."""
    return monitor.snapshot(db)


@router.get("/errors")
def errors(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    return {"items": monitor.last_errors(db), "hour": monitor.errors(db, 60)}


@router.get("/settings")
def application_settings(_: User = Depends(admin_user)) -> dict:
    """Эффективный startup-снимок backend-конфигурации; секреты уже обезличены manager-ом."""
    items = settings.snapshot()
    warnings: list[str] = []
    try:
        items.extend(report_store.browser_settings())
    except report_store.RenderError as exc:
        warnings.append(str(exc))
    return {"group": "backend", "items": items, "warnings": warnings}


AUDIT_CATEGORIES = ("success", "failed", "throttled")


@router.get("/security-audit")
def security_audit(category: str = "all", page: int = 1, page_size: int = 10,
                   _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Журнал безопасности с фильтром по исходу и постраничной выдачей: таблица растёт на каждую
    попытку входа, поэтому целиком её не отдаём. `category` вне трёх известных = «все»."""
    page = max(1, page)
    page_size = min(max(page_size, 1), 200)
    where = [SecurityAudit.outcome == category] if category in AUDIT_CATEGORIES else []
    total = db.scalar(select(func.count(SecurityAudit.id)).where(*where)) or 0
    rows = db.scalars(
        select(SecurityAudit).where(*where).order_by(SecurityAudit.id.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": [r.item() for r in rows], "total": int(total),
            "page": page, "page_size": page_size}


@router.delete("/security-audit")
def clear_security_audit(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Очистить журнал целиком: он растёт на каждую попытку входа, и разбор старых перебора
    заканчивается вместе с самим перебором."""
    removed = db.query(SecurityAudit).delete()
    db.commit()
    return {"removed": int(removed)}


@router.get("/users/{user_id}/visits")
def user_visits(user_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    if db.get(User, user_id) is None:
        raise LocalizedHTTPException(404, detail=lambda: say("admin.not_found"))
    rows = db.scalars(select(MetrikaClient).where(MetrikaClient.user_id == user_id)
                      .order_by(MetrikaClient.last_seen_at.desc(), MetrikaClient.client_id)).all()
    return {"items": [row.item() for row in rows]}
