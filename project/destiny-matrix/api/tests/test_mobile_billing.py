import datetime as dt
import json
from dataclasses import replace

import pytest
from sqlalchemy import func, select

from app import account_deletion, play_billing, store
from app.config import settings
from app.models import (AccountOperation, Entitlement, MetrikaClient, Notification, NotificationDelivery,
                        Payment, PlayOrder, PlayPurchase, Purchase, Reading, ReportJob, SecurityAudit, User, utcnow)
from app.payments import google_play as google


@pytest.fixture(autouse=True)
def native_settings(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "google_play_mock", True)
    monkeypatch.setattr(settings, "google_play_enabled", False)
    monkeypatch.setattr(settings, "reports_store", "local")
    monkeypatch.setattr(settings, "reports_dir", str(tmp_path / "pdfs"))
    store.reset()
    yield
    store.reset()


def order(client, headers, sku="single", birth="1987-06-14"):
    body = {"product_id": sku}
    if sku == "single":
        body["inputs"] = {"birth": birth, "sex": "f"}
    elif sku == "pair":
        body["inputs"] = {"a": {"birth": birth}, "b": {"birth": "1985-04-12"}}
    response = client.post("/api/mobile/billing/orders", headers=headers, json=body)
    assert response.status_code == 200, response.text
    return response.json()


def simulate(client, headers, checkout, state="purchased"):
    response = client.post("/api/mobile/billing/mock", headers=headers,
                           json={"order_id": checkout["order_id"], "state": state})
    assert response.status_code == 200, response.text
    return response.json()


def test_mock_is_explicit_and_never_works_in_prod(client, auth, monkeypatch):
    headers = auth()
    monkeypatch.setattr(settings, "google_play_mock", False)
    assert client.get("/api/mobile/billing/status", headers=headers).json()["provider"] is None
    assert client.post("/api/mobile/billing/orders", headers=headers, json={"product_id": "month"}).status_code == 503
    monkeypatch.setattr(settings, "google_play_mock", True)
    monkeypatch.setattr(settings, "app_env", "production")
    assert google.mock_enabled() is False
    assert client.post("/api/mobile/billing/mock", headers=headers, json={"order_id": "x", "state": "purchased"}).status_code == 404


def test_order_and_token_binding_idempotency_and_repeat_consumables(client, auth, db):
    headers, stranger = auth(), auth("other@example.ru")
    first = order(client, headers)
    assert order(client, headers)["order_id"] == first["order_id"]
    second = order(client, headers, birth="1988-03-21")
    assert first["obfuscated_account_id"] == second["obfuscated_account_id"]
    assert first["obfuscated_profile_id"] != second["obfuscated_profile_id"]
    receipt = simulate(client, headers, first)
    assert receipt["access"] and receipt["finalized"]
    request = {"product_id": "single", "purchase_token": receipt["purchase_token"]}
    for _ in range(2):
        response = client.post("/api/mobile/billing/verify", headers=headers, json=request)
        assert response.status_code == 200
        assert response.json()["reading_id"] == first["reading_id"]
    assert client.post("/api/mobile/billing/verify", headers=stranger, json=request).status_code == 409
    assert client.post("/api/mobile/billing/verify", headers=headers, json={**request, "order_id": second["order_id"]}).status_code == 409
    simulate(client, headers, second)
    assert db.scalar(select(func.count(Entitlement.id))) == 2
    assert db.scalar(select(func.count(Payment.id))) == 2


def test_pending_and_cancellation_never_grant_access(client, auth, db):
    headers = auth()
    checkout = order(client, headers, "pair")
    assert not simulate(client, headers, checkout, "pending")["access"]
    assert not simulate(client, headers, checkout, "canceled")["access"]
    assert db.scalar(select(func.count(Entitlement.id))) == 0


def test_subscription_authoritative_expiry_grace_hold_restore_and_cancel(client, auth, db):
    headers = auth()
    checkout = order(client, headers, "month")
    active = simulate(client, headers, checkout)
    assert active["access"] and active["auto_renewing"]
    assert simulate(client, headers, checkout, "grace")["access"]
    assert not simulate(client, headers, checkout, "hold")["access"]
    renewed = simulate(client, headers, checkout, "renewed")
    assert renewed["access"] and renewed["expires_at"] > active["expires_at"]
    canceled = simulate(client, headers, checkout, "canceled")
    assert canceled["access"] and not canceled["auto_renewing"]
    assert canceled["expires_at"] == renewed["expires_at"]
    response = client.post("/api/mobile/billing/restore", headers=headers, json={"purchases": []}).json()
    assert response["failed"] == 0 and response["items"][0]["access"]
    assert not simulate(client, headers, checkout, "expired")["access"]
    assert db.scalar(select(func.count(Entitlement.id))) == 1
    public = client.get("/api/mobile/billing/status", headers=headers).text
    assert active["purchase_token"] not in public


def test_refund_only_revokes_its_purchase(client, auth, db):
    headers = auth()
    first = order(client, headers)
    second = order(client, headers, birth="1988-03-21")
    simulate(client, headers, first)
    simulate(client, headers, second)
    uid = db.scalar(select(User.id).where(User.email == "user@example.ru"))
    db.add(Entitlement(user_id=uid, products='["personal"]', per_reading=True,
                       store_unlimited=False, reading_id=first["reading_id"]))
    db.commit()
    assert not simulate(client, headers, first, "refunded")["access"]
    rights = db.scalars(select(Entitlement)).all()
    assert sum(r.active() for r in rights) == 2  # Other purchase and independent admin grant survive.
    assert client.get(f"/api/readings/{first['reading_id']}", headers=headers).json()["unlocked"]


def test_deletion_revokes_sessions_returns_restore_scope_and_cancels_renewal(client, auth, db):
    headers = auth()
    checkout = order(client, headers, "month")
    simulate(client, headers, checkout)
    wrong = client.post("/api/mobile/account/delete", headers=headers, json={"current_password": "wrong"})
    assert wrong.status_code == 400
    deleted = client.post("/api/mobile/account/delete", headers=headers, json={"current_password": "secret123"})
    assert deleted.status_code == 200, deleted.text
    payload = deleted.json()
    assert payload["deletion"]["renewal_cancellation"] == "complete"
    restricted = {"Authorization": "Bearer " + payload["token"]}
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert client.get("/api/auth/me", headers=restricted).status_code == 401
    assert client.post("/api/mobile/billing/orders", headers=restricted, json={"product_id": "month"}).status_code == 401
    assert client.get("/api/mobile/account/deletion", headers=restricted).status_code == 200
    login = client.post("/api/auth/login", json={"email": "user@example.ru", "password": "secret123"}).json()
    assert login["deletion"]["requested_at"] == payload["deletion"]["requested_at"]
    restored = client.post("/api/mobile/account/restore", headers=restricted, json={})
    assert restored.status_code == 200
    normal = {"Authorization": "Bearer " + restored.json()["token"]}
    assert client.get("/api/auth/me", headers=normal).status_code == 200
    assert client.get("/api/mobile/account/deletion", headers=restricted).status_code == 401
    assert client.get("/api/mobile/billing/status", headers=normal).json()["subscriptions"][0]["auto_renewing"] is False


def test_failed_cancellation_is_durable_and_retried_after_restore(client, auth, db, monkeypatch):
    headers = auth()
    checkout = order(client, headers, "month")
    simulate(client, headers, checkout)
    cancel = play_billing.cancel
    monkeypatch.setattr(play_billing, "cancel", lambda *args: False)
    payload = client.post("/api/mobile/account/delete", headers=headers, json={"current_password": "secret123"}).json()
    assert payload["deletion"]["renewal_cancellation"] == "pending"
    restricted = {"Authorization": "Bearer " + payload["token"]}
    assert client.post("/api/mobile/account/restore", headers=restricted, json={}).status_code == 200
    monkeypatch.setattr(play_billing, "cancel", cancel)
    assert account_deletion.sweep(db)["canceled"] == 1
    assert db.scalar(select(PlayPurchase)).cancellation_pending is False


def test_purge_cleans_personal_data_and_keeps_financial_ledger(client, auth, db):
    headers = auth()
    checkout = order(client, headers)
    simulate(client, headers, checkout)
    user = db.scalar(select(User).where(User.email == "user@example.ru"))
    uid = user.id
    purchase = db.scalar(select(Purchase).where(Purchase.user_id == uid))
    purchase.offer_body = json.dumps({**purchase.body(), "persons": [{"birth": "1987-06-14"}], "email": user.email})
    db.add(SecurityAudit(action="login", outcome="success", email=user.email, ip="192.0.2.10"))
    db.add(AccountOperation(user_id=uid, type="change_email", data=json.dumps({"email": user.email, "new_email": "old@example.ru"}), expires_at=utcnow()))
    db.add(SecurityAudit(action="login", outcome="success", email="old@example.ru", ip="192.0.2.20"))
    key = f"v10/{uid}/{checkout['reading_id']}/ru/1.pdf"
    db.add(ReportJob(user_id=uid, reading_id=checkout["reading_id"], locale="ru", status="done", object_key=key))
    db.commit()
    store.store().upload(key, b"private pdf")
    store.store().upload(f"v1/{uid}/9/ru/1.pdf", b"historical private pdf")
    response = client.post("/api/mobile/account/delete", headers=headers, json={"current_password": "secret123"})
    assert response.status_code == 200
    db.refresh(user)
    user.deletion_requested_at = utcnow() - dt.timedelta(days=31)
    db.commit()
    assert account_deletion.purge(db, uid)
    assert not account_deletion.purge(db, uid)
    db.expire_all()
    user = db.get(User, uid)
    assert user.email == f"deleted-{uid}@invalid" and user.deleted_at
    assert db.scalar(select(func.count(Reading.id))) == 0
    assert db.scalar(select(func.count(Entitlement.id))) == 0
    assert db.scalar(select(func.count(AccountOperation.id))) == 0
    assert db.scalar(select(func.count(Purchase.id))) == 1
    assert db.scalar(select(func.count(Payment.id))) == 1
    assert db.scalar(select(func.count(PlayPurchase.id))) == 1
    assert all(a.email is None and a.ip is None for a in db.scalars(select(SecurityAudit)))
    assert "1987-06-14" not in db.get(Purchase, purchase.id).offer_body
    assert not list(store.store().root.rglob("*.pdf"))
    assert client.post("/api/auth/login", json={"email": "user@example.ru", "password": "secret123"}).status_code == 401


def test_google_adapter_uses_authoritative_state_and_expiry(monkeypatch):
    expiry = utcnow() + dt.timedelta(days=7)
    data = {"subscriptionState": "SUBSCRIPTION_STATE_ACTIVE", "externalAccountIdentifiers": {
        "obfuscatedExternalAccountId": "account", "obfuscatedExternalProfileId": "order"},
        "lineItems": [{"productId": "month", "expiryTime": expiry.isoformat(),
                       "autoRenewingPlan": {"autoRenewEnabled": True}}]}
    monkeypatch.setattr(google, "request", lambda *args: data)
    result = google.verify("month", "secret-token")
    assert result.access and result.expires_at == expiry
    data["subscriptionState"] = "SUBSCRIPTION_STATE_ON_HOLD"
    assert not google.verify("month", "secret-token").access
    data["lineItems"][0]["productId"] = "other-product"
    with pytest.raises(google.PlayError):
        google.verify("month", "secret-token")


def test_rtdn_rejects_unconfigured_or_unsigned_requests(client):
    assert client.post("/api/mobile/billing/rtdn", json={"message": {}}).status_code == 401


def test_real_finalize_failure_retries_without_duplicate_grant(client, auth, db, monkeypatch):
    headers = auth()
    monkeypatch.setattr(settings, "google_play_mock", False)
    monkeypatch.setattr(settings, "google_play_enabled", True)
    monkeypatch.setattr(settings, "google_play_credentials", "not-opened-in-test.json")
    checkout = order(client, headers)
    state = google.State("purchased", checkout["obfuscated_account_id"], checkout["obfuscated_profile_id"])
    monkeypatch.setattr(google, "verify", lambda *args: state)
    calls = []
    def finalize(sku, token):
        calls.append((sku, token))
        if len(calls) == 1:
            raise google.PlayError("temporary outage")
    monkeypatch.setattr(google, "finalize", finalize)
    payload = {"product_id": "single", "purchase_token": "google-token", "order_id": checkout["order_id"]}
    first = client.post("/api/mobile/billing/verify", headers=headers, json=payload)
    assert first.status_code == 200
    assert first.json()["access"] and not first.json()["finalized"]
    assert db.scalar(select(func.count(Entitlement.id))) == 1
    retry = client.post("/api/mobile/billing/verify", headers=headers, json=payload)
    assert retry.json()["finalized"]
    assert db.scalar(select(func.count(Entitlement.id))) == 1
    assert len(calls) == 2


def test_real_provider_rejects_account_or_profile_mismatch(client, auth, db, monkeypatch):
    headers = auth()
    monkeypatch.setattr(settings, "google_play_mock", False)
    monkeypatch.setattr(settings, "google_play_enabled", True)
    monkeypatch.setattr(settings, "google_play_credentials", "not-opened-in-test.json")
    checkout = order(client, headers)
    monkeypatch.setattr(google, "verify", lambda *args: google.State("purchased", "wrong-account", checkout["order_id"]))
    response = client.post("/api/mobile/billing/verify", headers=headers, json={
        "product_id": "single", "purchase_token": "google-token", "order_id": checkout["order_id"]})
    assert response.status_code == 409
    assert db.scalar(select(func.count(Entitlement.id))) == 0
    assert db.scalar(select(func.count(PlayPurchase.id))) == 0


def test_repeated_and_stale_rtdn_query_current_state(client, auth, db, monkeypatch):
    import base64
    headers = auth()
    monkeypatch.setattr(settings, "google_play_mock", False)
    monkeypatch.setattr(settings, "google_play_enabled", True)
    monkeypatch.setattr(settings, "google_play_credentials", "not-opened-in-test.json")
    checkout = order(client, headers, "month")
    state = google.State("active", checkout["obfuscated_account_id"], checkout["order_id"],
                         expires_at=utcnow() + dt.timedelta(days=9), auto_renewing=True, finalized=True)
    calls = []
    def current(*args):
        calls.append(1)
        return state
    monkeypatch.setattr(google, "verify", current)
    monkeypatch.setattr(google, "authenticate_push", lambda _: None)
    def notify(message_id, event_type):
        data = {"packageName": settings.google_play_package, "subscriptionNotification": {
            "notificationType": event_type, "purchaseToken": "google-token", "subscriptionId": "month"}}
        payload = {"message": {"messageId": message_id, "data": base64.b64encode(json.dumps(data).encode()).decode()}}
        response = client.post("/api/mobile/billing/rtdn", json=payload)
        assert response.status_code == 200, response.text
    notify("one", 2)
    notify("one", 2)
    assert len(calls) == 1
    state = replace(state, state="hold", auto_renewing=True)
    notify("two", 2)  # Stale "renewed" event must not grant when Google currently says HOLD.
    db.expire_all()
    assert not db.scalar(select(Entitlement)).active()
    state = replace(state, state="active", expires_at=utcnow() + dt.timedelta(days=18))
    notify("three", 5)  # Stale hold event must not revoke a current valid renewal.
    db.expire_all()
    assert db.scalar(select(Entitlement)).active()
    assert db.scalar(select(func.count(Entitlement.id))) == 1


def test_pending_deletion_cannot_buy_through_website_email_checkout(client, auth):
    headers = auth()
    assert client.post("/api/mobile/account/delete", headers=headers, json={"current_password": "secret123"}).status_code == 200
    response = client.post("/api/payments/mock", json={"email": "user@example.ru", "tariff": "month"})
    assert response.status_code == 403


def test_late_presence_flush_does_not_restore_deleted_metadata(client, auth, db, db_engine):
    from app import presence
    from sqlalchemy.orm import sessionmaker
    headers = auth()
    uid = db.scalar(select(User.id).where(User.email == "user@example.ru"))
    presence.touch_user(uid)
    assert client.post("/api/mobile/account/delete", headers=headers, json={"current_password": "secret123"}).status_code == 200
    factory = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    assert presence.flush(factory) == 0
    db.expire_all()
    assert db.get(User, uid).last_seen_at is None
