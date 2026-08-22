"""Регрессии на дефекты, найденные живым прогоном по сайту. Гоняются вместе с остальными."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app import payments, reports
from app.models import Entitlement, Payment, ReportJob

pytestmark = pytest.mark.bug


@pytest.fixture
def bank(monkeypatch):
    monkeypatch.setattr(payments.tbank.settings, "tbank_terminal_key", "1234DEMO")
    monkeypatch.setattr(payments.tbank.settings, "tbank_password", "secret")
    monkeypatch.setattr(payments.PROVIDERS["mock"], "enabled", lambda: False)

    def fake_call(method, payload):
        if method == "Init":
            return {"Success": True, "PaymentId": "900500", "Status": "NEW",
                    "PaymentURL": "https://pay.tbank.ru/xyz", "OrderId": payload["OrderId"]}
        if method == "Cancel":
            return {"Success": True, "Status": "CANCELED"}
        return {"Success": True, "Status": "CONFIRMED"}

    monkeypatch.setattr(payments.PROVIDERS["tbank"], "call", fake_call)


def signed(fields: dict) -> dict:
    return {**fields, "Token": payments.PROVIDERS["tbank"].token(fields)}


def paid(client, email="bug@example.ru", birth="1990-01-01"):
    body = client.post("/api/payments/start",
                       json={"tariff": "single", "email": email, "birth": birth}).json()
    note = signed({"TerminalKey": "1234DEMO", "OrderId": body["order_id"], "Success": True,
                   "Status": "CONFIRMED", "PaymentId": body["payment_id"], "Amount": 25_000})
    client.post("/api/payments/notify", json=note)
    return body


def test_a2_cancel_of_authorized_payment_is_a_refund(client, db, bank, auth):
    """A2. Банк на отмену неоплаченного списания отвечает CANCELED. Сейчас это трактуется как
    неудача, поэтому доступ остаётся открытым, а денег у человека уже нет."""
    from app.config import settings

    body = paid(client, "a2@example.ru")
    payment = db.scalars(select(Payment)).one()
    headers = auth(settings.admins[0])

    answer = client.post(f"/api/admin/payments/{payment.id}/refund", headers=headers)
    assert answer.status_code == 200, answer.text

    db.refresh(payment)
    right = db.scalars(select(Entitlement)).one()
    assert payment.refunded_at is not None, "возврат не отмечен: платёж считается действующим"
    assert right.revoked_at is not None, "право не снято — доступ остался после возврата"


def test_a10_second_print_waits_for_the_running_one(client, db, monkeypatch):
    """A10. Человек обновил страницу во время печати и нажал снова: сейчас запускается второй
    полный рендер вместо ожидания уже идущего."""
    monkeypatch.setattr(reports.settings, "browser_url", "http://browser:3001")
    monkeypatch.setattr(reports.settings, "print_wait_seconds", 1)
    monkeypatch.setattr(reports.settings, "s3_reports_bucket", "test-bucket")
    monkeypatch.setattr(reports.settings, "s3_access_key", "key")
    monkeypatch.setattr(reports, "upload", lambda key, pdf: None)
    monkeypatch.setattr(reports, "link", lambda key: f"https://bucket/{key}")

    renders = []

    def slow_render(url):
        renders.append(url)
        return b"%PDF-1.4 x"

    monkeypatch.setattr(reports, "render", slow_render)

    body = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "a10@example.ru",
                             "birth": "1991-02-02"}).json()
    headers = {"Authorization": f"Bearer {body['token']}"}
    matrix_id = body["matrix_id"]

    first = client.post("/api/reports/render", json={"matrix_id": matrix_id}, headers=headers)
    assert first.status_code == 200

    # имитируем «первая задача ещё в работе»: возвращаем её в состояние running
    job = db.scalars(select(ReportJob)).one()
    job.status = "running"
    job.object_key = None
    db.commit()

    second = client.post("/api/reports/render", json={"matrix_id": matrix_id}, headers=headers)
    assert second.status_code in (200, 504), second.text
    jobs = db.scalars(select(ReportJob)).all()
    assert len(jobs) == 1, f"на одну матрицу заведено задач: {len(jobs)} — печать пошла заново"
    assert len(renders) == 1, f"рендеров: {len(renders)} — второй запуск не дождался первого"


def test_a15_admin_card_shows_the_date_not_the_row_number(client, auth, db):
    """A15. Разбирая обращение «за что списали 250 ₽», админ видит внутренний номер записи
    вместо даты, которую открыл платёж."""
    from app.config import settings

    body = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "a15@example.ru",
                             "birth": "1993-03-14", "sex": "f"}).json()
    admin = auth(settings.admins[0])
    card = client.get(f"/api/admin/users/{body['user']['id']}", headers=admin).json()

    payment = card["payments"][0]
    assert "1993-03-14" in str(payment), f"в платеже нет даты, только номер: {payment}"
