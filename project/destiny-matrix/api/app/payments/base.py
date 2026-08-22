"""Контракт платёжного провайдера: всё, что знает о нём остальная система.

Наружу провайдер отдаёт нормализованный исход, а не свои строки статусов, — иначе логика прав
знала бы про AUTHORIZED, succeeded и прочие названия из чужих API.
"""
from __future__ import annotations

import enum
from dataclasses import dataclass
from typing import Protocol, runtime_checkable


class PaymentError(RuntimeError):
    pass


class Outcome(enum.StrEnum):
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"
    FAILED = "failed"
    # Отмена — это либо снятие холда до списания, либо полный возврат после него. Что именно
    # произошло, знает не провайдер, а наша запись платежа, поэтому исход остаётся отдельным.
    CANCELED = "canceled"


@dataclass(frozen=True)
class Started:
    external_id: str
    pay_url: str | None
    status: str
    outcome: Outcome = Outcome.PENDING


@dataclass(frozen=True)
class Update:
    """Что провайдер сообщил о платеже: чем платёж опознать, наш исход и его собственный статус."""
    external_id: str | None
    order_id: str | None
    outcome: Outcome
    status: str


@runtime_checkable
class Provider(Protocol):
    name: str

    def enabled(self) -> bool: ...

    def start(self, order_id: str, amount: int, title: str, email: str | None) -> Started: ...

    def state(self, external_id: str) -> Update: ...

    def cancel(self, external_id: str) -> Update: ...

    def read_notification(self, body: dict) -> Update: ...
