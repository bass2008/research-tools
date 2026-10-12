"""Диагностика вебхуков в существующем серверном логе, без изменения платежей."""
from __future__ import annotations

import datetime as dt
import json
import logging
import uuid
from contextlib import contextmanager

from fastapi import HTTPException

# Используем настроенный Uvicorn handler: INFO обычного root-логгера на проде не выводится.
log = logging.getLogger("uvicorn.error.payment_webhook")

MASK = "[REDACTED]"
SENSITIVE_FIELDS = {
    "terminalkey", "authorization", "proxyauthorization", "apikey", "cookie", "setcookie",
    "pan", "cardnumber", "cardid", "rebillid", "expdate", "expiry", "expirydate",
    "expirationdate", "cvv", "cvv2", "cvc", "cvc2", "cvn", "pin", "pinblock",
    "cryptogram", "cardcryptogram", "cavv", "pares", "pareq", "creq", "cres", "md",
}


def masked_payload(value):
    """Копия JSON с сохранением всех полей, включая email, и маскировкой секретных значений."""
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            name = "".join(char for char in key.lower() if char.isalnum())
            secret = name in SENSITIVE_FIELDS or name.endswith(("token", "password", "secret", "signature"))
            result[key] = MASK if secret else masked_payload(item)
        return result
    if isinstance(value, list):
        return [masked_payload(item) for item in value]
    return value


def _write(event: str, fields: dict) -> None:
    log.info("%s", json.dumps({"event": event, "at": dt.datetime.now(dt.UTC).isoformat(), **fields},
                             ensure_ascii=False))


@contextmanager
def notification_log(provider: str, payload: dict):
    identity = {"webhook_id": uuid.uuid4().hex, "provider": provider}
    _write("received", {**identity, "payload": masked_payload(payload)})
    result = {**identity, "signature_valid": None, "payment_id": None,
              "status_before": None, "status_after": None, "result": "error", "http_status": 200}
    try:
        yield result
    except Exception as exc:
        result["http_status"] = exc.status_code if isinstance(exc, HTTPException) else 500
        # Текст исключения может содержать исходное тело/секреты. Тип и этап обработки
        # остаются в диагностике; исходное исключение передаём прежнему обработчику ошибок.
        result["error_type"] = type(exc).__name__
        raise
    finally:
        _write("completed", result)
