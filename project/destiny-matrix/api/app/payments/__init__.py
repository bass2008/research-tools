from __future__ import annotations

import uuid

from .base import Outcome, PaymentError, Provider, Started, Update
from .mock import Mock
from .tbank import Tbank

PROVIDERS: dict[str, Provider] = {p.name: p for p in (Tbank(), Mock())}
ORDER_PREFIX = "arcana-"


def get(name: str) -> Provider | None:
    return PROVIDERS.get(name)


def active() -> Provider | None:
    """Кем принимаем оплату сейчас: заданным в настройках, иначе живым эквайрингом, иначе моком."""
    from ..config import settings

    chosen = PROVIDERS.get(settings.payment_provider) if settings.payment_provider else None
    if chosen is not None and chosen.enabled():
        return chosen
    for provider in PROVIDERS.values():
        if provider.enabled():
            return provider
    return None


def order_id(payment_id: int) -> str:
    """Номер заказа обязан быть уникальным на весь терминал провайдера, а id платежа таким не
    является: базу стенда чистят, и номера начинаются заново — банк отвечал «заказ уже существует».
    Поэтому к id добавляется случайный хвост."""
    return f"{ORDER_PREFIX}{payment_id}-{uuid.uuid4().hex[:8]}"


def payment_id_of(order: str | None) -> int | None:
    if not order or not str(order).startswith(ORDER_PREFIX):
        return None
    head = str(order).removeprefix(ORDER_PREFIX).split("-")[0]
    return int(head) if head.isdigit() else None


__all__ = ["Outcome", "PaymentError", "Provider", "Started", "Update", "PROVIDERS", "active",
           "get", "order_id", "payment_id_of"]
