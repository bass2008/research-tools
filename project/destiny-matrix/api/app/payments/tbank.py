"""Т-Банк, сценарий nonPCI: карту принимает форма банка.

Подпись считается по корневым полям запроса: значения сортируются по ключам, склеиваются и
хешируются SHA-256. Вложенные объекты (DATA, Receipt) в подпись не входят.
"""
from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.request

from ..config import settings
from .base import Outcome, PaymentError, Started, Update

PAID = ("AUTHORIZED", "CONFIRMED")
# ссылка на оплату ещё жива: человек либо не открывал форму, либо открыл и не доплатил
OPEN = ("NEW", "FORM_SHOWED", "AUTHORIZING", "3DS_CHECKING", "3DS_CHECKED")
GIVEN_BACK = ("REFUNDED", "PARTIAL_REFUNDED", "REVERSED")
LOST = ("REJECTED", "DEADLINE_EXPIRED", "ATTEMPTS_EXPIRED", "AUTH_FAIL")

NAME_LIMIT = 128        # предел банка на название позиции в чеке


def receipt(amount: int, email: str) -> dict:
    """Состав чека одной покупки. Сумма позиций обязана совпасть с суммой платежа, поэтому позиция
    ровно одна: цена, количество 1 и итог — одно и то же число копеек. Наименование берём из
    настроек, а не из тарифа: в чек уходит предмет договора, а не название с витрины."""
    return {
        "Email": email,
        "Taxation": settings.tbank_taxation,
        "Items": [{
            "Name": settings.tbank_item_name[:NAME_LIMIT],
            "Price": amount,
            "Quantity": 1,
            "Amount": amount,
            "Tax": settings.tbank_vat,
            "PaymentObject": settings.tbank_payment_object,
            "PaymentMethod": settings.tbank_payment_method,
        }],
    }


def outcome_of(status: str) -> Outcome:
    if status in PAID:
        return Outcome.PAID
    if status in GIVEN_BACK:
        return Outcome.REFUNDED
    if status in LOST:
        return Outcome.FAILED
    if status == "CANCELED":
        return Outcome.CANCELED
    return Outcome.PENDING


class Tbank:
    name = "tbank"

    def enabled(self) -> bool:
        return bool(settings.tbank_terminal_key and settings.tbank_password)

    def token(self, fields: dict, password: str | None = None) -> str:
        flat = {k: v for k, v in fields.items()
                if v is not None and not isinstance(v, (dict, list)) and k != "Token"}
        flat["Password"] = password or settings.tbank_password
        return hashlib.sha256("".join(_text(flat[key]) for key in sorted(flat)).encode()).hexdigest()

    def call(self, method: str, payload: dict) -> dict:
        body = {"TerminalKey": settings.tbank_terminal_key, **payload}
        body["Token"] = self.token(body)
        request = urllib.request.Request(f"{settings.tbank_api_url}/{method}",
                                         data=json.dumps(body, ensure_ascii=False).encode(),
                                         headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=settings.tbank_timeout_seconds) as resp:
                answer = json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            raise PaymentError(f"{method}: банк ответил {exc.code}") from exc
        except OSError as exc:
            raise PaymentError(f"{method}: банк недоступен ({exc})") from exc
        if not answer.get("Success"):
            raise PaymentError(f"{method}: {answer.get('Message') or ''} "
                               f"{answer.get('Details') or ''} "
                               f"(код {answer.get('ErrorCode')})".strip())
        return answer

    def start(self, order_id: str, amount: int, title: str, email: str | None) -> Started:
        if not email:
            raise PaymentError("Init: чек не составить без адреса покупателя")
        payload = {
            "Amount": amount,
            "OrderId": order_id,
            "Description": settings.tbank_item_name[:250],
            "SuccessURL": f"{settings.site_url}/pay/done?order={order_id}",
            "FailURL": f"{settings.site_url}/pay/fail?order={order_id}",
            "NotificationURL": f"{settings.site_url}/api/payments/notify/{self.name}",
        }
        payload["DATA"] = {"Email": email}
        payload["Receipt"] = receipt(amount, email)
        answer = self.call("Init", payload)
        status = str(answer.get("Status") or "NEW")
        return Started(external_id=str(answer["PaymentId"]), pay_url=answer.get("PaymentURL"),
                       status=status, outcome=outcome_of(status))

    def reusable(self, status: str) -> bool:
        return status in OPEN

    def state(self, external_id: str) -> Update:
        answer = self.call("GetState", {"PaymentId": external_id})
        return self._update(answer)

    def cancel(self, external_id: str) -> Update:
        answer = self.call("Cancel", {"PaymentId": external_id})
        return self._update(answer, fallback="REVERSED")

    def read_notification(self, body: dict) -> Update:
        given = str(body.get("Token") or "")
        fields = {k: v for k, v in body.items() if k != "Token"}
        if not given or self.token(fields) != given:
            raise PaymentError("подпись уведомления не совпала")
        return self._update(body)

    def _update(self, answer: dict, fallback: str = "") -> Update:
        status = str(answer.get("Status") or fallback)
        return Update(external_id=str(answer.get("PaymentId") or "") or None,
                      order_id=str(answer.get("OrderId") or "") or None,
                      outcome=outcome_of(status), status=status)


def _text(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)
