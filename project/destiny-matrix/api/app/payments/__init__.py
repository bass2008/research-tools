from __future__ import annotations

import uuid

from .base import Outcome, PaymentError, Provider, Started, Update
from .mock import Mock
from .tbank import Tbank

PROVIDERS: dict[str, Provider] = {p.name: p for p in (Tbank(), Mock())}
ORDER_PREFIX = "arcana-"


def get(name: str) -> Provider | None:
    return PROVIDERS.get(name)


def available():
    from .. import sites
    return tuple(c for c in sites.current().payments
                 if (provider := get(c.provider)) is not None and provider.enabled())


def select_connection(identifier: str | None = None):
    from ..http_errors import LocalizedHTTPException
    from ..i18n import say
    connections = available()
    connection = next((c for c in connections if c.id == identifier), None) if identifier else next(iter(connections), None)
    if connection is None:
        raise LocalizedHTTPException(403, detail=lambda: say("pay.region_unavailable"))
    return connection


def for_payment(payment):
    from ..sites import payment_connection
    connection = payment_connection(payment)
    return get(connection.provider) if connection else None


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


__all__ = ["Outcome", "PaymentError", "Provider", "Started", "Update", "PROVIDERS", "available", "select_connection", "for_payment",
           "get", "order_id", "payment_id_of"]
