from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..i18n import say
from .. import access, printing, reports, tariffs
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import ReportJob, SavedMatrix, User, default_title, utcnow
from ..schemas import ReportRequest
from ..security import create_print_token, read_file_token, read_print_token
from ..store import disposition, store

router = APIRouter(prefix="/reports", tags=["reports"])


def _own_matrix(db: Session, user: User, matrix_id: int) -> SavedMatrix:
    row = db.get(SavedMatrix, matrix_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=say("matrix.not_found"))
    return row


def _filename(row: SavedMatrix) -> str:
    """Имя файла в загрузках: дата разбора, а не номер задачи печати."""
    return f"{default_title(row.birth)}.pdf".replace("/", "-")


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


@router.get("/file")
def file(token: str = Query(..., min_length=16)) -> Response:
    """Выдача файла из локального хранилища — замена подписанной ссылке S3. Пропуск живёт час,
    как и подпись, и годится ровно на один ключ: в PDF есть дата рождения."""
    if settings.reports_store != "local":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=say("report.not_found"))
    read = read_file_token(token)
    if read is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=say("report.link_expired"))
    key, filename = read
    try:
        body = store().read(key)
    except (OSError, ValueError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=say("report.file_missing")) from None
    headers = {"Content-Disposition": disposition(filename)} if filename else {}
    return Response(content=body, media_type="application/pdf", headers=headers)


@router.post("/render")
def render(payload: ReportRequest, user: User = Depends(current_user),
           db: Session = Depends(get_db)) -> dict:
    """Синхронно: пока запрос идёт, PDF печатается. Задача в очереди нужна не клиенту, а админу —
    видеть, что печатали, сколько это заняло и что упало."""
    row = _own_matrix(db, user, payload.matrix_id)
    if not access.unlocked_matrix(db, user, row.id):
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED,
                            detail=say("report.not_paid"))

    done = None if payload.fresh else printing.ready(db, user.id, row.id)
    if done is not None and done.object_key:
        # тот же файл, а не новая печать: повторное нажатие не должно ни ждать, ни платить CPU
        return {"job_id": done.id, "status": "done", "cached": True,
                "url": reports.link(done.object_key, _filename(row)), "size_bytes": done.size_bytes,
                "seconds": done.seconds()}

    if not settings.pdf_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail=say("report.print_off"))

    busy = printing.running(db, user.id, row.id)
    if busy is not None:
        waited = _wait_for(db, busy)
        if waited is not None:
            return {"job_id": waited.id, "status": "done", "cached": True,
                    "url": reports.link(waited.object_key, _filename(row)), "size_bytes": waited.size_bytes,
                    "seconds": waited.seconds()}
        if busy.status == "running":
            raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT,
                                detail=say("report.print_running"))

    try:
        job = printing.run(db, user.id, row.id)
    except printing.Busy as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail=say("report.print_busy")) from exc
    except Exception as exc:                       # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            detail=say("report.print_failed")) from exc
    return {"job_id": job.id, "status": "done", "cached": False,
            "url": reports.link(job.object_key, _filename(row)), "size_bytes": job.size_bytes,
            "seconds": job.seconds()}


@router.get("/page/{matrix_id}")
def page(matrix_id: int, t: str = Query(..., description="print-токен"),
         db: Session = Depends(get_db)) -> dict:
    """Данные для страницы печати. Пропуск годится только на одну матрицу и живёт минуту,
    поэтому куку владельца браузерному сервису отдавать не нужно."""
    read = read_print_token(t)
    if read is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=say("report.pass_invalid"))
    user_id, allowed = read
    if allowed != matrix_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=say("report.pass_other_matrix"))
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=say("report.pass_invalid"))
    row = _own_matrix(db, user, matrix_id)
    # страница печати считает матрицу сама, как и обычный разбор: ей нужны дата, пол и признак
    # оплаты, а не готовые разделы
    unlocked = access.unlocked_matrix(db, user, row.id)
    plan = tariffs.get(db, tariffs.SINGLE_ID)
    # Название плана берётся из тарифа только там, где тарифы и правда показываются: на витрине
    # без кассы их имена остаются русскими из посевной таблицы, и они уезжали в шапку PDF.
    if not unlocked:
        plan_name = say("report.plan_free")
    elif plan and not settings.all_free_without_payment:
        plan_name = plan.name
    else:
        plan_name = say("report.plan_full")
    return {**row.item(), "unlocked": unlocked, "plan": plan_name}


@router.get("")
def listing(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(ReportJob).where(ReportJob.user_id == user.id)
                      .order_by(ReportJob.id.desc())).all()
    return {"items": [row.item() for row in rows]}
