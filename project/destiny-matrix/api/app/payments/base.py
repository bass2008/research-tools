"""Контракт платёжного провайдера: всё, что знает о нём остальная система.

Наружу провайдер отдаёт нормализованный исход, а не свои строки статусов, — иначе логика прав
знала бы про AUTHORIZED, succeeded и прочие названия из чужих API.
"""
from __future__ import annotations

import enum
from dataclasses import dataclass
from typing import Protocol, runtime_checkable


class PaymentError(RuntimeError):
    """Keep provider diagnostics for logs; expose a locale-bound public explanation."""
    def __init__(self, message: str, *, key: str = "pay.gateway_failed", **params):
        super().__init__(message)
        self.key = key
        self.params = params

    def public_message(self) -> str:
        from ..i18n import say
        return say(self.key, **self.params)


class Outcome(enum.StrEnum):
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"
    FAILED = "failed"
    # Отмена — это либо снятие холда до списания, либо полный возврат после него. Что именно
    # произошло, знает не провайдер, а наша запись платежа, поэтому исход остаётся отдельным.
    CANCELED = "canceled"


@dataclass(frozen=True)
class PaymentUrls:
    success: str
    fail: str
    notification: str


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

    def start(self, order_id: str, amount: int, title: str, email: str | None, *, urls: PaymentUrls) -> Started: ...

    def state(self, external_id: str) -> Update: ...

    def reusable(self, status: str) -> bool:
        """Можно ли вернуть человека к этому платежу вместо создания нового счёта."""
        ...

    def cancel(self, external_id: str) -> Update: ...

    def read_notification(self, body: dict) -> Update: ...
