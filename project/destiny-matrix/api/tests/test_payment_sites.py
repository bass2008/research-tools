"""Граница домена/языка проверяется без реальных обращений в банк."""
import json
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy import func, select

from app import mail, payments, sites, store, sweep
from app.config import settings
from app.models import Entitlement, Payment, SavedMatrix, User

RU = "https://test.arcana-sense.ru"
COM = "https://test.arcana-sense.com"
BUY = {"tariff": "single", "email": "region@example.ru", "birth": "1993-03-31"}


def header(origin=RU, locale="ru"):
    return {sites.HEADER: origin, "Accept-Language": locale}


@pytest.fixture
def regional(monkeypatch, client):
    connection = {"id": "tbank", "provider": "tbank", "notificationUrl": RU + "/api/payments/notify/tbank"}
    profiles = [{"origin": RU, "defaultLocale": "ru", "locales": ["ru"], "payments": [connection]},
                {"origin": COM, "defaultLocale": "en", "locales": ["en", "ru"], "payments": []}]
    monkeypatch.setattr(settings, "site_profiles", json.dumps(profiles))
    monkeypatch.setattr(settings, "tbank_terminal_key", "123DEMO")
    monkeypatch.setattr(settings, "tbank_password", "regional-test-password")
    client.headers.update(header())
    calls = []

    def bank(method, payload):
        calls.append((method, payload))
        if method == "Init":
            return {"PaymentId": str(len(calls)), "PaymentURL": "https://bank.invalid/pay", "Status": "NEW"}
        return {"PaymentId": payload["PaymentId"], "Status": "CONFIRMED" if method == "GetState" else "REFUNDED"}

    monkeypatch.setattr(payments.PROVIDERS["tbank"], "call", bank)
    return profiles, calls


def begin(client, **kwargs):
    response = client.post("/api/payments/start", json=BUY, **kwargs)
    assert response.status_code == 200, response.text
    return response.json()


def signed(body, **changes):
    fields = {"TerminalKey": settings.tbank_terminal_key, "PaymentId": body["payment_id"],
              "OrderId": body["order_id"], "Success": True, "Amount": 25000,
              "Status": "CONFIRMED", **changes}
    return {**fields, "Token": payments.PROVIDERS["tbank"].token(fields)}


@pytest.mark.parametrize("locale", ["en", "ru"])
@pytest.mark.parametrize("path,provider", [("start", None), ("start", "tbank"), ("start", "mock"), ("mock", None)])
def test_com_blocks_every_payment_before_writing(client, db, regional, locale, path, provider):
    before = {model: db.scalar(select(func.count()).select_from(model)) for model in (User, SavedMatrix, Payment)}
    response = client.post(f"/api/payments/{path}", headers=header(COM, locale), json={**BUY, "provider": provider})
    assert response.status_code == 403
    assert response.json()["messages"]["ru"] == "На данный момент нет доступной оплаты для вашего региона"
    for model, count in before.items():
        assert db.scalar(select(func.count()).select_from(model)) == count
    assert regional[1] == []
    tariffs = client.get("/api/tariffs", headers=header(COM, locale)).json()
    assert tariffs["payment_providers"] == [] and tariffs["test_payments"] is False


def test_ru_does_not_fall_back_to_enabled_mock(client, db, regional, monkeypatch):
    monkeypatch.setattr(settings, "tbank_terminal_key", "")
    assert settings.mock_payments
    assert client.get("/api/tariffs").json()["payment_providers"] == []
    assert client.post("/api/payments/start", json=BUY).status_code == 403
    assert client.post("/api/payments/mock", json=BUY).status_code == 403
    assert db.scalar(select(func.count()).select_from(Payment)) == 0


def test_context_and_return_urls_are_not_chosen_by_language(client, db, regional):
    begin(client, headers=header(RU, "en"))  # .ru допускает только ru
    payment = db.scalars(select(Payment)).one()
    assert payment.body()["site_origin"] == RU
    assert payment.body()["locale"] == "ru"
    assert payment.body()["connection_id"] == "tbank"
    payload = regional[1][0][1]
    assert payload["NotificationURL"] == RU + "/api/payments/notify/tbank"
    for key in ("SuccessURL", "FailURL"):
        url = urlsplit(payload[key])
        assert url.netloc == "test.arcana-sense.ru"
        assert parse_qs(url.query) == {"order": [payment.order_id], "lang": ["ru"]}


def test_missing_or_unknown_site_is_rejected_before_registration(client, db, regional):
    client.headers.pop(sites.HEADER)
    for context in ({}, {sites.HEADER: "https://attacker.invalid"}):
        response = client.post("/api/auth/register", headers=context,
                               json={"email": BUY["email"], "password": "123"})
        assert response.status_code == 400
    assert db.scalar(select(func.count()).select_from(User)) == 0


def test_callback_host_signature_and_exact_payment_identity(client, db, regional):
    body = begin(client)
    good = signed(body)
    assert client.post("/api/payments/notify/tbank", headers=header(COM), json=good).status_code == 404
    assert client.post("/api/payments/notify/tbank", json={**good, "Token": "forged"}).status_code == 403
    for bad in (signed(body, PaymentId="another"), signed(body, OrderId=body["order_id"] + "-forged")):
        assert client.post("/api/payments/notify/tbank", json=bad).status_code == 404
    assert db.scalar(select(func.count()).select_from(Entitlement)) == 0
    assert client.post("/api/payments/notify/tbank", json=good).status_code == 200
    assert client.post("/api/payments/notify/tbank", json=good).status_code == 200
    assert db.scalar(select(func.count()).select_from(Entitlement)) == 1


def test_foreign_connection_cannot_confirm_payment(client, db, regional, monkeypatch):
    profiles, _ = regional
    profiles[0]["payments"].append({"id": "mock", "provider": "mock",
                                    "notificationUrl": RU + "/api/payments/notify/mock"})
    monkeypatch.setattr(settings, "site_profiles", json.dumps(profiles))
    body = begin(client)
    assert client.post("/api/payments/notify/mock", json=signed(body)).status_code == 404
    assert db.scalar(select(func.count()).select_from(Entitlement)) == 0


def test_com_sync_reads_shared_state_without_calling_bank(client, db, regional):
    body = begin(client)
    calls = len(regional[1])
    auth = {**header(COM, "en"), "Authorization": "Bearer " + body["token"]}
    response = client.post("/api/payments/sync", headers=auth, json={"order_id": body["order_id"]})
    assert response.status_code == 200 and not response.json()["paid"]
    assert len(regional[1]) == calls
    assert client.post("/api/payments/notify/tbank", json=signed(body)).status_code == 200
    assert client.get("/api/auth/me", headers=auth).json()["owned"] == 1
    assert client.get("/api/payments", headers=auth).status_code == 200
    assert len(regional[1]) == calls


def test_sweep_restores_payment_origin_and_language(client, db, regional, monkeypatch):
    begin(client)
    letters = []
    monkeypatch.setattr(mail, "send", lambda *args: letters.append(args))
    with sites.using_site(sites.find(COM)):
        assert sweep.run(db).changed == 1
    assert len(letters) == 1
    rendered = str(letters[0])
    assert RU + "/report?" in rendered and "lang=ru" in rendered
    assert COM + "/report?" not in rendered


@pytest.mark.parametrize("origin,locale", [(RU, "ru"), (COM, "en"), (COM, "ru")])
def test_account_mail_and_pdf_use_request_origin(client, regional, monkeypatch, origin, locale):
    letters = []
    monkeypatch.setattr(mail, "send", lambda *args: letters.append(args))
    headers = header(origin, locale)
    response = client.post("/api/auth/register", headers=headers, json={"email": BUY["email"], "password": "123"})
    assert response.status_code == 200
    assert origin + f"/account?lang={locale}" in str(letters[-1])
    assert client.post("/api/auth/reset/request", headers=headers, json={"email": BUY["email"]}).status_code == 200
    assert origin + f"/reset?lang={locale}" in str(letters[-1])
    with sites.using_site(sites.find(origin)):
        assert store.LocalStore().link("sample.pdf").startswith(origin + "/api/reports/file?")


def test_parallel_site_requests_do_not_share_context(client, regional):
    def request(index):
        origin = RU if index % 2 else COM
        response = client.get("/api/tariffs", headers=header(origin, "en"))
        assert response.status_code == 200
        assert bool(response.json()["payment_providers"]) == (origin == RU)
        assert response.headers["Content-Language"] == ("ru" if origin == RU else "en")
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(request, range(16)))


def test_bad_callback_configuration_fails_closed(regional, monkeypatch):
    profiles, _ = regional
    profiles[0]["payments"][0]["notificationUrl"] = COM + "/api/payments/notify/tbank"
    monkeypatch.setattr(settings, "site_profiles", json.dumps(profiles))
    with pytest.raises(ValueError, match="callback"):
        sites.profiles()


def test_existing_russian_payment_keeps_callback_and_rights_without_rewriting(client, db, regional):
    body = begin(client)
    payment = db.scalars(select(Payment)).one()
    snapshot = payment.body()
    for field in ("site_origin", "connection_id", "locale"):
        snapshot.pop(field, None)
    original = json.dumps(snapshot, ensure_ascii=False)
    payment.tariff_body = original
    db.commit()
    assert client.post("/api/payments/notify", json=signed(body)).status_code == 200
    assert client.post("/api/payments/notify", json=signed(body)).status_code == 200
    db.refresh(payment)
    assert payment.tariff_body == original
    assert db.scalar(select(func.count()).select_from(Entitlement)) == 1


def test_admin_on_com_refunds_using_the_payment_connection(client, db, regional, auth):
    body = begin(client)
    assert client.post("/api/payments/notify/tbank", json=signed(body)).status_code == 200
    payment = db.scalars(select(Payment)).one()
    admin = auth(settings.admins[0])
    response = client.post(f"/api/admin/payments/{payment.id}/refund", headers={**admin, **header(COM, "en")})
    assert response.status_code == 200, response.text
    assert regional[1][-1] == ("Cancel", {"PaymentId": payment.external_id})
    db.refresh(payment)
    assert payment.refunded_at is not None


def test_shared_connection_keeps_com_return_and_mail_context(client, db, regional, monkeypatch):
    # Проверка расширяемости на игрушечном провайдере, без подключения Т-Банка к COM.
    profiles, calls = regional
    mock = {"id": "shared-mock", "provider": "mock", "notificationUrl": RU + "/api/payments/notify/shared-mock"}
    for profile in profiles:
        profile["payments"] = [mock]
    monkeypatch.setattr(settings, "site_profiles", json.dumps(profiles))
    captured = []
    letters = []
    original = payments.PROVIDERS["mock"].start

    def capture(*args, **kwargs):
        captured.append(kwargs["urls"])
        return original(*args, **kwargs)

    monkeypatch.setattr(payments.PROVIDERS["mock"], "start", capture)
    monkeypatch.setattr(mail, "send", lambda *args: letters.append(args))
    begin(client, headers=header(COM, "ru"))
    assert captured[0].success.startswith(COM + "/pay/done?")
    assert "lang=ru" in captured[0].success
    assert captured[0].notification == RU + "/api/payments/notify/shared-mock"
    assert COM + "/report?" in str(letters[0])
    assert calls == []


@pytest.mark.parametrize("language", ["de", "fr-CA", "*", "en;q=0"])
def test_unsupported_language_uses_domain_default(client, regional, language):
    response = client.get("/api/tariffs", headers=header(COM, language))
    assert response.status_code == 200
    assert response.headers["Content-Language"] == "en"
    assert response.json()["items"][0]["name"] == "Full reading for one date"
