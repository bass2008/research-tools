"""Админка: кто зарегистрирован, что купил, какие даты сохранил.

Только чтение. Признак админа — почта из `settings.admins`, а не колонка в users: схема без
миграций, и новое поле заставило бы пересоздавать таблицу вместе с платежами.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import access, monitor, printing
from .. import payments as gateway
from ..routers.payments import apply as apply_payment
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import Payment, PaymentSweep, ReportJob, SavedMatrix, User, iso

router = APIRouter(prefix="/admin", tags=["admin"])


def admin_user(user: User = Depends(current_user)) -> User:
    if not settings.is_admin(user.email):
        # 404, а не 403: существование админских адресов посторонним знать незачем
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Не найдено")
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
        "is_admin": settings.is_admin(user.email),
        "matrices": access.saved_count(db, user),
        "payments": int(paid[0]),
        "spent": int(paid[1]),
        "scopes": summary["scopes"],
        "owned": summary["owned"],
        "until": summary["until"],
        "rights": len(rights),
    }


@router.get("/users")
def users(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(User).order_by(User.id.desc())).all()
    return {"items": [_row(db, u) for u in rows]}


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
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Платёж не найден")
    # Возврат идемпотентен: повторное нажатие отдаёт текущее состояние, а не ошибку. Иначе
    # устаревшая вкладка получала отказ банка «уже возвращён», а строка оставалась «оплачен» с
    # живой кнопкой — интерфейс уверял, что деньги на месте, хотя они уже вернулись.
    if payment.refunded_at is not None:
        return {"ok": True, "status": payment.status, "refunded_at": iso(payment.refunded_at),
                "already": True}
    provider = gateway.get(payment.provider)
    if provider is None or not provider.enabled():
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Этот платёж отменить нельзя: способ оплаты недоступен")
    try:
        update = provider.cancel(payment.external_id)
    except gateway.PaymentError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    apply_payment(db, payment, update)
    return {"ok": True, "status": payment.status, "refunded_at": iso(payment.refunded_at)}


@router.get("/reports")
def reports(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Очередь печати: что печатали, сколько это заняло и что упало. Клиенту она не видна —
    для него запрос синхронный."""
    rows = db.execute(
        select(ReportJob, User.email).join(User, User.id == ReportJob.user_id)
        .order_by(ReportJob.id.desc())
    ).all()
    running = sum(1 for job, _e in rows if job.status == "running")
    done = [job.seconds() for job, _e in rows if job.status == "done" and job.seconds()]
    return {
        "items": [{**job.item(), "user_id": job.user_id, "email": email} for job, email in rows],
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
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
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


@router.get("/pulse")
def pulse(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    """Состояние машины и продукта сейчас. Нужна отдельно от облачного мониторинга: когда до
    консоли не добраться, это единственное место, где видно, что происходит."""
    return monitor.snapshot(db)


@router.get("/errors")
def errors(_: User = Depends(admin_user), db: Session = Depends(get_db)) -> dict:
    return {"items": monitor.last_errors(db), "hour": monitor.errors(db, 60)}
