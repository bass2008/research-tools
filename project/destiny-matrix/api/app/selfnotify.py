"""Послать себе уведомление о платеже — то, что на стенде не может сделать банк.

Подпись считается тем же кодом, что проверяет эндпоинт, поэтому путь уведомления проверяется
целиком, без публичного адреса.

    python -m app.selfnotify 12 CONFIRMED
"""
from __future__ import annotations

import json
import sys
import urllib.request

from sqlalchemy import select

from . import payments
from .config import settings
from .db import SessionLocal
from .models import Payment


def send(payment_id: int, status: str = "CONFIRMED") -> int:
    with SessionLocal() as db:
        payment = db.get(Payment, payment_id) or db.scalar(
            select(Payment).where(Payment.external_id == str(payment_id)))
        if payment is None:
            raise SystemExit(f"платежа {payment_id} нет")
        provider = payments.get(payment.provider)
        if provider is None or not hasattr(provider, "token"):
            raise SystemExit(f"провайдер {payment.provider} уведомлений не подписывает")
        body = {"TerminalKey": settings.tbank_terminal_key, "OrderId": payments.order_id(payment.id),
                "Success": True, "Status": status, "PaymentId": payment.external_id,
                "Amount": payment.amount}
        body["Token"] = provider.token(body)

    request = urllib.request.Request(f"http://127.0.0.1:8010{settings.api_prefix}/payments/notify/"
                                     f"{payment.provider}",
                                     data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as answer:
        print(f"уведомление доставлено: {answer.status} {answer.read().decode()[:120]}")
        return answer.status


if __name__ == "__main__":
    send(int(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else "CONFIRMED")
