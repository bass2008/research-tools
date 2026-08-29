"""Запись в журнал безопасности. Отдельная сессия, чтобы отметка ставилась и на отказе
(неуспешный вход коммита не делает) и не роняла ответ при сбое записи."""
from __future__ import annotations

import ipaddress
import logging

from fastapi import Request

from .db import SessionLocal
from .models import SecurityAudit

log = logging.getLogger("audit")


def client_ip(request: Request) -> str | None:
    # FastAPI снаружи недоступен: X-Real-IP сюда может поставить только наш BFF, а ему значение
    # перед этим задаёт nginx через $remote_addr. X-Forwarded-For не читаем намеренно — его
    # первый элемент может прислать сам клиент.
    real = request.headers.get("x-real-ip")
    if real:
        try:
            return str(ipaddress.ip_address(real.strip()))
        except ValueError:
            pass
    return request.client.host if request.client else None


def record(action: str, outcome: str, email: str | None = None, ip: str | None = None) -> None:
    try:
        with SessionLocal() as db:
            db.add(SecurityAudit(action=action, outcome=outcome,
                                 email=email[:320] if email else None, ip=ip))
            db.commit()
    except Exception as exc:                       # noqa: BLE001 — журнал не имеет права ломать ответ
        log.warning("аудит не записан: %s", exc)
