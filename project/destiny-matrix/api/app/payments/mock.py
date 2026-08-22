"""Мок-провайдер: платёж считается оплаченным сразу. Нужен стенду и тестам, где живых ключей нет."""
from __future__ import annotations

import uuid

from ..config import settings
from .base import Outcome, Started, Update


class Mock:
    name = "mock"

    def enabled(self) -> bool:
        return settings.mock_payments

    def start(self, order_id: str, amount: int, title: str, email: str | None) -> Started:
        return Started(external_id=f"mock-{uuid.uuid4().hex[:24]}", pay_url=None,
                       status="CONFIRMED", outcome=Outcome.PAID)

    def state(self, external_id: str) -> Update:
        return Update(external_id=external_id, order_id=None, outcome=Outcome.PAID,
                      status="CONFIRMED")

    def cancel(self, external_id: str) -> Update:
        return Update(external_id=external_id, order_id=None, outcome=Outcome.REFUNDED,
                      status="REFUNDED")

    def read_notification(self, body: dict) -> Update:
        return Update(external_id=str(body.get("PaymentId") or "") or None,
                      order_id=str(body.get("OrderId") or "") or None,
                      outcome=Outcome.PAID, status="CONFIRMED")
