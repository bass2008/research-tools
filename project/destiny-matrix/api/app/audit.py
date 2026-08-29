"""Запись в журнал безопасности. Отдельная сессия, чтобы отметка ставилась и на отказе
(неуспешный вход коммита не делает) и не роняла ответ при сбое записи."""
from __future__ import annotations

import logging

from fastapi import Request

from .db import SessionLocal
from .models import SecurityAudit

log = logging.getLogger("audit")


def client_ip(request: Request) -> str | None:
    # За nginx→BFF реальный адрес приедет только когда добавят проброс X-Forwarded-For; пока
    # берём что есть, чтобы колонка была готова.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()[:64]
    return request.client.host if request.client else None


def record(action: str, outcome: str, email: str | None = None, ip: str | None = None) -> None:
    try:
        with SessionLocal() as db:
            db.add(SecurityAudit(action=action, outcome=outcome,
                                 email=email[:320] if email else None, ip=ip))
            db.commit()
    except Exception as exc:                       # noqa: BLE001 — журнал не имеет права ломать ответ
        log.warning("аудит не записан: %s", exc)
