from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import access, printing, reports, tariffs
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import ReportJob, SavedMatrix, User, utcnow
from ..schemas import ReportRequest
from ..security import create_print_token, read_print_token

router = APIRouter(prefix="/reports", tags=["reports"])


def _own_matrix(db: Session, user: User, matrix_id: int) -> SavedMatrix:
    row = db.get(SavedMatrix, matrix_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Матрица не найдена")
    return row


def _wait_for(db: Session, job: ReportJob) -> ReportJob | None:
    """Дождаться чужой печати вместо запуска своей: человек обновил страницу и нажал снова, а
    второй рендер — это ещё полминуты ожидания и второй файл в хранилище."""
    deadline = time.monotonic() + settings.print_wait_seconds
    while time.monotonic() < deadline:
        time.sleep(0.5)
        db.expire(job)
        db.refresh(job)
        if job.status == "done" and job.object_key:
            return job
        if job.status != "running":
            return None
    return None


@router.post("/render")
def render(payload: ReportRequest, user: User = Depends(current_user),
           db: Session = Depends(get_db)) -> dict:
    """Синхронно: пока запрос идёт, PDF печатается. Задача в очереди нужна не клиенту, а админу —
    видеть, что печатали, сколько это заняло и что упало."""
    row = _own_matrix(db, user, payload.matrix_id)
    if not access.unlocked_matrix(db, user, row.id):
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED,
                            detail="Разбор этой даты не оплачен")

    done = printing.ready(db, user.id, row.id)
    if done is not None and done.object_key:
        # тот же файл, а не новая печать: повторное нажатие не должно ни ждать, ни платить CPU
        return {"job_id": done.id, "status": "done", "cached": True,
                "url": reports.link(done.object_key), "size_bytes": done.size_bytes,
                "seconds": done.seconds()}

    if not settings.pdf_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Печать PDF не настроена")

    busy = printing.running(db, user.id, row.id)
    if busy is not None:
        waited = _wait_for(db, busy)
        if waited is not None:
            return {"job_id": waited.id, "status": "done", "cached": True,
                    "url": reports.link(waited.object_key), "size_bytes": waited.size_bytes,
                    "seconds": waited.seconds()}
        if busy.status == "running":
            raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT,
                                detail="Печать этого разбора всё ещё идёт — откройте страницу "
                                       "через минуту, файл появится сам")

    try:
        job = printing.run(db, user.id, row.id)
    except printing.Busy as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Сейчас печатается много разборов — нажмите ещё раз через "
                                   "минуту, ваш файл встанет в очередь") from exc
    except Exception as exc:                       # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            detail="Не удалось напечатать PDF") from exc
    return {"job_id": job.id, "status": "done", "cached": False,
            "url": reports.link(job.object_key), "size_bytes": job.size_bytes,
            "seconds": job.seconds()}


@router.get("/page/{matrix_id}")
def page(matrix_id: int, t: str = Query(..., description="print-токен"),
         db: Session = Depends(get_db)) -> dict:
    """Данные для страницы печати. Пропуск годится только на одну матрицу и живёт минуту,
    поэтому куку владельца браузерному сервису отдавать не нужно."""
    read = read_print_token(t)
    if read is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Пропуск недействителен")
    user_id, allowed = read
    if allowed != matrix_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Пропуск выдан на другую матрицу")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Пропуск недействителен")
    row = _own_matrix(db, user, matrix_id)
    # страница печати считает матрицу сама, как и обычный разбор: ей нужны дата, пол и признак
    # оплаты, а не готовые разделы
    unlocked = access.unlocked_matrix(db, user, row.id)
    plan = tariffs.get(db, tariffs.SINGLE_ID)
    return {**row.item(), "unlocked": unlocked,
            "plan": (plan.name if plan else "Полный разбор") if unlocked else "Бесплатный просмотр"}


@router.get("")
def listing(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(ReportJob).where(ReportJob.user_id == user.id)
                      .order_by(ReportJob.id.desc())).all()
    return {"items": [row.item() for row in rows]}
