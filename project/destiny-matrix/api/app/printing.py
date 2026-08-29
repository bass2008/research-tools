"""Печать разбора: одна и та же работа для запроса человека и для прогрева после оплаты.

Прогрев нужен, чтобы к моменту, когда человек нажмёт «Сохранить как PDF», файл уже лежал в
хранилище: печать на слабой машине занимает десятки секунд, и ждать их после покупки незачем.
Печать идёт в отдельном потоке, по одной за раз — браузер держит около 300 МБ, и две печати рядом
машине не по силам.
"""
from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import access, reports
from .config import settings
from .db import SessionLocal
from .models import ReportJob, SavedMatrix, User, as_utc, utcnow
from .security import create_print_token

log = logging.getLogger("arcana.printing")

# один поток на весь процесс: прогрев сериализуется и не спорит с запросами человека за память
_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="print")
_started: set[tuple[int, int]] = set()
_lock = threading.Lock()

# Нажатия людей идут каждое в своём запросе, и без общего ограничения десяток «Сохранить как PDF»
# кладёт браузерный контейнер по памяти. Лишние ждут очереди: медленнее — лучше, чем убитый браузер.
_slots = threading.BoundedSemaphore(settings.print_slots)


class Busy(RuntimeError):
    """Все места печати заняты дольше, чем человек согласен ждать."""


_active = 0


def ready(db: Session, user_id: int, matrix_id: int) -> ReportJob | None:
    return db.scalars(select(ReportJob)
                      .where(ReportJob.user_id == user_id, ReportJob.matrix_id == matrix_id,
                             ReportJob.status == "done")
                      .order_by(ReportJob.id.desc())).first()


def expire_stale(db: Session) -> int:
    """Закрыть брошенные задачи независимо от того, попросят ли ту же матрицу снова.

    Раньше уборка жила только в ``running`` и потому никогда не срабатывала для очереди
    администратора: старая строка бессрочно считалась работающей рядом с живым счётчиком 0.
    """
    cutoff = utcnow().timestamp() - settings.browser_timeout_seconds - 30
    changed = 0
    rows = db.scalars(select(ReportJob).where(ReportJob.status == "running")).all()
    for row in rows:
        started = as_utc(row.started_at or row.created_at)
        if started.timestamp() >= cutoff:
            continue
        row.status = "failed"
        row.error = "печать не завершилась: задача брошена"
        row.finished_at = utcnow()
        changed += 1
    if changed:
        db.commit()
    return changed


def running(db: Session, user_id: int, matrix_id: int) -> ReportJob | None:
    """Печать этой же матрицы, уже запущенная кем-то. Задачу старше окна печати считаем брошенной:
    браузер мог умереть, и ждать её бессмысленно."""
    expire_stale(db)
    row = db.scalars(select(ReportJob)
                     .where(ReportJob.user_id == user_id, ReportJob.matrix_id == matrix_id,
                            ReportJob.status == "running")
                     .order_by(ReportJob.id.desc())).first()
    return row


def run(db: Session, user_id: int, matrix_id: int) -> ReportJob:
    """Напечатать и положить файл в хранилище. Задача в очереди нужна админу: видно, что печатали,
    сколько это заняло и что упало."""
    global _active
    if not _slots.acquire(timeout=settings.print_wait_seconds):
        raise Busy("все места печати заняты")
    with _lock:
        _active += 1
    job = ReportJob(user_id=user_id, matrix_id=matrix_id, status="running", started_at=utcnow())
    db.add(job)
    db.commit()
    db.refresh(job)
    try:
        token = create_print_token(matrix_id, user_id)
        url = f"{settings.web_internal_url.rstrip('/')}/print/report?m={matrix_id}&t={token}"
        pdf = reports.render(url)
        key = f"{user_id}/{matrix_id}/{job.id}.pdf"
        reports.upload(key, pdf)
    except Exception as exc:                       # noqa: BLE001
        job.status = "failed"
        job.error = str(exc)[:300]
        job.finished_at = utcnow()
        db.commit()
        raise
    finally:
        with _lock:
            _active -= 1
        _slots.release()
    job.status = "done"
    job.object_key = key
    job.size_bytes = len(pdf)
    job.finished_at = utcnow()
    db.commit()
    db.refresh(job)
    return job


def _warm(user_id: int, matrix_id: int) -> None:
    with SessionLocal() as db:
        try:
            user = db.get(User, user_id)
            row = db.get(SavedMatrix, matrix_id)
            if user is None or row is None or row.user_id != user_id:
                return
            if not access.unlocked_matrix(db, user, matrix_id):
                return
            if ready(db, user_id, matrix_id) is not None:
                return
            if running(db, user_id, matrix_id) is not None:
                return
            job = run(db, user_id, matrix_id)
            log.info("прогрет разбор матрицы %s: %s Б за %s c", matrix_id, job.size_bytes,
                     job.seconds())
        except Exception as exc:                   # noqa: BLE001
            # прогрев — удобство, а не обязательство: его отказ не должен ломать оплату
            log.warning("прогрев разбора матрицы %s не удался: %s", matrix_id, exc)
        finally:
            with _lock:
                _started.discard((user_id, matrix_id))


def pending() -> int:
    """Сколько прогревов ещё в работе. Нужно тестам и админке: печать живёт вне запроса."""
    with _lock:
        return len(_started)


def active() -> int:
    """Сколько печатей идёт прямо сейчас — по этому числу видно, упирается ли машина в места."""
    with _lock:
        return _active


def warm(user_id: int, matrix_id: int | None) -> bool:
    """Поставить печать в фон сразу после оплаты. Возвращает, взялись ли за работу."""
    if matrix_id is None or not settings.print_warmup or not settings.pdf_enabled:
        return False
    with _lock:
        if (user_id, matrix_id) in _started:
            return False
        _started.add((user_id, matrix_id))
    _pool.submit(_warm, user_id, matrix_id)
    return True
