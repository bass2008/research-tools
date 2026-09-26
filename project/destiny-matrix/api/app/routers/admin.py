"""Админка: кто зарегистрирован, когда заходил, что купил и какие даты сохранил."""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from engine.matrix import calculate

from .. import access, audit, monitor, printing
from .. import reports as report_store
from .. import payments as gateway
from ..routers.payments import apply as apply_payment
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..i18n import using_locale, say, validation_message
from ..http_errors import LocalizedHTTPException
from ..models import (Entitlement, Payment, PaymentSweep, ReportJob, SavedMatrix, SecurityAudit,
                      User, default_title, iso)
from ..schemas import BirthIn
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
        select(func.count(Payment.id), func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.user_id == user.id, Payment.paid_at.is_not(None),
               Payment.refunded_at.is_(None))
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
    }


@router.get("/users")
def users(page: int = 1, page_size: int = 10,
          _: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Страница списка: у каждой строки считаются права и покупки, поэтому отдавать всех разом
    дорого. Порядок — от новых регистраций к старым."""
    page = max(1, page)
    page_size = min(max(page_size, 1), 200)
    total = db.scalar(select(func.count(User.id))) or 0
    rows = db.scalars(
        select(User).order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": [_row(db, u) for u in rows], "total": int(total),
            "page": page, "page_size": page_size}


@router.get("/payments")
def payments(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Все платежи с почтой плательщика: в кабинете видны только свои."""
    rows = db.execute(
        select(Payment, User.email).join(User, User.id == Payment.user_id)
        .order_by(Payment.id.desc())
    ).all()
    dates = {m.id: m.item() for m in db.scalars(select(SavedMatrix)).all()}
    return {"items": [{**payment.item(), "user_id": payment.user_id, "email": email,
                       "matrix": dates.get(payment.matrix_id)}
                      for payment, email in rows]}


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
    """Карточка пользователя: его матрицы и его платежи."""
    user = db.get(User, user_id)
    if user is None:
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("admin.no_user"))
    rights = access.active_rights(db, user)
    matrices = db.scalars(
        select(SavedMatrix).where(SavedMatrix.user_id == user.id).order_by(SavedMatrix.id.desc())
    ).all()
    payment_rows = db.scalars(
        select(Payment).where(Payment.user_id == user.id).order_by(Payment.id.desc())
    ).all()
    return {
        "user": _row(db, user),
        "matrices": [{**m.item(), **access.matrix_state(rights, m.id)} for m in matrices],
        "payments": [{**p.item(),
                      "matrix": next((m.item() for m in matrices if m.id == p.matrix_id), None)}
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


@router.post("/users/{user_id}/matrices")
def add_matrix(user_id: int, payload: BirthIn, _: User = Depends(admin_user),
               db: Session = Depends(get_db)) -> dict:
    """Выдать пользователю матрицу без оплаты: разбор открыт, но правом без платежа.

    Право бессрочное и без `payment_id` — по этому признаку кабинет показывает её открытой, но не
    купленной (`access.matrix_state`). Повторная выдача той же даты ничего не ломает: матрица
    находится по дате и полу, а право не задваивается.
    """
    user = db.get(User, user_id)
    if user is None:
        raise LocalizedHTTPException(status.HTTP_404_NOT_FOUND, detail=lambda: say("admin.no_user"))
    try:
        calculate(payload.birth, payload.sex)
    except ValueError as exc:
        raise LocalizedHTTPException(status.HTTP_400_BAD_REQUEST,
                                     detail=lambda: validation_message(exc)) from exc

    row = db.scalar(select(SavedMatrix).where(SavedMatrix.user_id == user.id,
                                              SavedMatrix.birth == payload.birth,
                                              SavedMatrix.sex == payload.sex))
    if row is None:
        row = SavedMatrix(user_id=user.id, birth=payload.birth, sex=payload.sex,
                          title=None)
        db.add(row)
        db.commit()
        db.refresh(row)
    if not access.unlocked_matrix(db, user, row.id):
        db.add(Entitlement(user_id=user.id, matrix_id=row.id, scope=json.dumps([access.SINGLE]),
                           note="выдана админом"))
        db.commit()
        printing.warm(user.id, row.id)
    rights = access.active_rights(db, user)
    return {**row.item(), **access.matrix_state(rights, row.id)}


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
    matrix = db.get(SavedMatrix, job.matrix_id)
    with using_locale(job.locale):
        name = f"{default_title(matrix.birth)}.pdf".replace("/", "-") if matrix else None
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
        with using_locale(job.locale), printing.exclusive(job.user_id, job.matrix_id):
            fresh = printing.run(db, job.user_id, job.matrix_id)
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
