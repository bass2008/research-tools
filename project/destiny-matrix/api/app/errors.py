"""Журнал пятисоток.

Раньше их не было видно нигде, кроме вывода контейнера: ни счётчика для тревоги, ни истории.
Персональных данных здесь нет намеренно — только метод, путь и голова трассировки; тела запросов
и адреса почты не записываются.
"""
from __future__ import annotations

import datetime as dt
import logging
import traceback

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select

from .db import SessionLocal
from .models import ErrorLog, utcnow

log = logging.getLogger("errors")

TRACE_HEAD = 800       # головы трассировки хватает, чтобы понять место; хвост базе не нужен
KEEP_DAYS = 7
KEEP_ROWS = 500


def remember(method: str, path: str, status: int, message: str, trace: str | None) -> None:
    try:
        with SessionLocal() as db:
            db.add(ErrorLog(method=method[:8], path=path[:200], status=status,
                            message=(message or "")[:300],
                            trace=trace[:TRACE_HEAD] if trace else None))
            _trim(db)
            db.commit()
    except Exception as exc:                       # noqa: BLE001 — журнал не имеет права ломать ответ
        log.warning("ошибка не записана: %s", exc)


def _trim(db) -> None:
    db.execute(delete(ErrorLog).where(ErrorLog.at < utcnow() - dt.timedelta(days=KEEP_DAYS)))
    keep = db.scalars(select(ErrorLog.id).order_by(ErrorLog.id.desc()).limit(KEEP_ROWS)).all()
    if len(keep) == KEEP_ROWS:
        db.execute(delete(ErrorLog).where(ErrorLog.id < min(keep)))


async def watch(request: Request, call_next):
    """Ловим и необработанные исключения, и честно возвращённые 5xx."""
    try:
        answer = await call_next(request)
    except Exception as exc:                       # noqa: BLE001 — записываем и отдаём 500
        remember(request.method, request.url.path, 500, f"{type(exc).__name__}: {exc}",
                 traceback.format_exc())
        return JSONResponse({"detail": "Внутренняя ошибка"}, status_code=500)
    if answer.status_code >= 500:
        remember(request.method, request.url.path, answer.status_code, "ответ сервера", None)
    return answer
