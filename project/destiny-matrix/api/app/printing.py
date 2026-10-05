"""Печать разбора: одна и та же работа для запроса человека и для прогрева после оплаты.

Прогрев нужен, чтобы к моменту, когда человек нажмёт «Сохранить как PDF», файл уже лежал в
хранилище: печать на слабой машине занимает десятки секунд, и ждать их после покупки незачем.
Печать идёт в отдельном потоке, по одной за раз — браузер держит около 300 МБ, и две печати рядом
машине не по силам.
"""
from __future__ import annotations

import logging
import threading
import time
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import access, reports
from .config import settings
from .i18n import current_locale, using_locale
from .db import SessionLocal
from .models import ReportJob, SavedMatrix, User, as_utc, utcnow
from .store import store
from .security import create_print_token

log = logging.getLogger("arcana.printing")

# один поток на весь процесс: прогрев сериализуется и не спорит с запросами человека за память
_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="print")
_started: set[tuple[int, int, str]] = set()
_lock = threading.Lock()
_report_locks: dict[tuple[int, int, str], tuple[threading.Lock, int]] = {}

# Bump when the printed content changes: older PDFs are reprinted on the next owner download,
# historical objects stay. v2: internal print Host links; v3: rewritten chakra readings.
PDF_REVISION = "v4"


@contextmanager
def exclusive(user_id: int, matrix_id: int):
    """One report operation across HTTP threads and the warmup thread of this API process."""
    key = (user_id, matrix_id, current_locale())
    with _lock:
        mutex, users = _report_locks.get(key, (threading.Lock(), 0))
        _report_locks[key] = (mutex, users + 1)
    acquired = False
    try:
        acquired = mutex.acquire(timeout=settings.print_wait_seconds)
        if not acquired:
            raise Busy("эта печать ещё не завершилась")
        yield
    finally:
        if acquired:
            mutex.release()
        with _lock:
            _, users = _report_locks[key]
            if users == 1:
                del _report_locks[key]
            else:
                _report_locks[key] = (mutex, users - 1)

# Нажатия людей идут каждое в своём запросе, и без общего ограничения десяток «Сохранить как PDF»
# кладёт браузерный контейнер по памяти. Лишние ждут очереди: медленнее — лучше, чем убитый браузер.
_slots = threading.BoundedSemaphore(settings.print_slots)


class Busy(RuntimeError):
    """Все места печати заняты дольше, чем человек согласен ждать."""


_active = 0
# Ждут свободного места. Считается отдельно от `_started`: тот набор — прогревы «в работе», и
# печатающийся прогрев попадал бы в оба числа сразу, отчего одна печать показывалась админке как
# «1 печатается, 1 в очереди».
_waiting = 0


def available(db: Session, row: ReportJob) -> bool:
    """Reconcile the stored status with the file before offering a download."""
    if row.status != "done":
        return False
    if row.object_key and store().exists(row.object_key):
        return True
    row.status = "expired"
    row.object_key = None
    db.commit()
    return False


def ready(db: Session, user_id: int, matrix_id: int) -> ReportJob | None:
    """Готовый файл, если он и правда существует. Хранилище чистит отчёты по сроку, а запись
    остаётся `done` — без этой проверки кнопка отдала бы ссылку на удалённый объект."""
    row = db.scalars(select(ReportJob)
                     .where(ReportJob.user_id == user_id, ReportJob.matrix_id == matrix_id, ReportJob.locale == current_locale(),
                            ReportJob.status == "done")
                     .order_by(ReportJob.id.desc())).first()
    if row is None:
        return None
    if row.object_key and row.object_key.startswith(f"{PDF_REVISION}/") and available(db, row):
        return row
    row.status = "expired"
    row.object_key = None
    db.commit()
    return None


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
                     .where(ReportJob.user_id == user_id, ReportJob.matrix_id == matrix_id, ReportJob.locale == current_locale(),
                            ReportJob.status == "running")
                     .order_by(ReportJob.id.desc())).first()
    return row


def run(db: Session, user_id: int, matrix_id: int) -> ReportJob:
    """Напечатать и положить файл в хранилище. Задача в очереди нужна админу: видно, что печатали,
    сколько это заняло и что упало."""
    global _active, _waiting
    with _lock:
        _waiting += 1
    try:
        got = _slots.acquire(timeout=settings.print_wait_seconds)
    finally:
        with _lock:
            _waiting -= 1
    if not got:
        raise Busy("все места печати заняты")
    with _lock:
        _active += 1
    job = ReportJob(user_id=user_id, matrix_id=matrix_id, locale=current_locale(), status="running", started_at=utcnow())
    db.add(job)
    db.commit()
    db.refresh(job)
    try:
        token = create_print_token(matrix_id, user_id)
        url = f"{settings.web_internal_url.rstrip('/')}/print/report?m={matrix_id}&t={token}&lang={current_locale()}"
        pdf = reports.render(url)
        key = f"{PDF_REVISION}/{user_id}/{matrix_id}/{current_locale()}/{job.id}.pdf"
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


def _warm(user_id: int, matrix_id: int, locale: str) -> None:
    with using_locale(locale), SessionLocal() as db:
        try:
            with exclusive(user_id, matrix_id):
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
                _started.discard((user_id, matrix_id, locale))


def pending() -> int:
    """Сколько прогревов ещё в работе. Нужно тестам и админке: печать живёт вне запроса.

    Это не очередь: печатающийся прогрев числится здесь всё время печати. Для очереди — `waiting`.
    """
    with _lock:
        return len(_started)


def waiting() -> int:
    """Сколько печатей ждёт свободного места — те, что уже пришли, но ещё не начались."""
    with _lock:
        return _waiting


def active() -> int:
    """Сколько печатей идёт прямо сейчас — по этому числу видно, упирается ли машина в места."""
    with _lock:
        return _active


REPRINT_ATTEMPTS = 3
REPRINT_PAUSE_SECONDS = 20


def _reprint(user_id: int, matrix_id: int, locale: str) -> bool:
    current = f"{PDF_REVISION}/%"
    with using_locale(locale), SessionLocal() as db:
        try:
            with exclusive(user_id, matrix_id):
                group = (ReportJob.user_id == user_id, ReportJob.matrix_id == matrix_id,
                         ReportJob.locale == locale, ReportJob.status == "done")
                user = db.get(User, user_id)
                if (user is not None and access.unlocked_matrix(db, user, matrix_id)
                        and db.scalars(select(ReportJob.id).where(*group, ReportJob.object_key.like(current))).first() is None
                        and running(db, user_id, matrix_id) is None):
                    job = run(db, user_id, matrix_id)
                    log.info("перепечатан разбор матрицы %s: %s Б за %s c", matrix_id, job.size_bytes, job.seconds())
                # Expire only after a successful reprint: a failed one stays stale and is retried next start.
                for old in db.scalars(select(ReportJob).where(*group, ReportJob.object_key.not_like(current))).all():
                    old.status = "expired"
                    old.object_key = None
                db.commit()
            return True
        except Exception as exc:                   # noqa: BLE001
            log.warning("перепечатка разбора матрицы %s не удалась: %s", matrix_id, exc)
            return False


def _reprint_all(groups: list[tuple[int, int, str]]) -> None:
    # The API can come up before web on a release, so the first prints may fail: retry with a pause.
    for group in groups:
        for attempt in range(REPRINT_ATTEMPTS):
            if _reprint(*group):
                break
            if attempt + 1 < REPRINT_ATTEMPTS:
                time.sleep(REPRINT_PAUSE_SECONDS)


# Release-time migration, safe on every start: PDFs of an older PDF_REVISION are reprinted in the
# background; once all are current it does nothing.
def reprint_stale() -> int:
    if not settings.print_warmup or not settings.pdf_enabled:
        return 0
    try:
        with SessionLocal() as db:
            groups = db.execute(select(ReportJob.user_id, ReportJob.matrix_id, ReportJob.locale).distinct()
                                .where(ReportJob.status == "done",
                                       ReportJob.object_key.not_like(f"{PDF_REVISION}/%"))).all()
    except Exception as exc:                       # noqa: BLE001
        log.warning("устаревшие PDF не найдены: %s", exc)
        return 0
    if groups:
        _pool.submit(_reprint_all, [tuple(g) for g in groups])
        log.info("перепечатка устаревших PDF: %s", len(groups))
    return len(groups)


def warm(user_id: int, matrix_id: int | None) -> bool:
    """Поставить печать в фон сразу после оплаты. Возвращает, взялись ли за работу."""
    if matrix_id is None or not settings.print_warmup or not settings.pdf_enabled:
        return False
    locale = current_locale()
    with _lock:
        if (user_id, matrix_id, locale) in _started:
            return False
        _started.add((user_id, matrix_id, locale))
    _pool.submit(_warm, user_id, matrix_id, locale)
    return True
