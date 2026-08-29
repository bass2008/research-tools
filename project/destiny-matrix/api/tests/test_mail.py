"""Почта: письма уходят там, где обещано, и не роняют операцию, когда SMTP не настроен."""
from __future__ import annotations

from app import mail
from app.security import hash_password, password_fingerprint


def test_purchase_sends_letter(client, monkeypatch):
    sent = []
    monkeypatch.setattr(mail, "send", lambda to, subject, body: sent.append((to, subject, body)) or True)
    r = client.post("/api/payments/mock", json={"tariff": "single", "email": "buy@example.ru", "birth": "1985-03-03"})
    assert r.status_code == 200
    to, subject, body = sent[0]
    # письмо юридического значения не имеет, поэтому язык человеческий: «разбор», а не «работы»
    assert to == "buy@example.ru" and "разбор готов" in subject.lower()
    assert "работ" not in body and "задани" not in body, body
    assert r.json()["payment_id"] in body
    # дата рождения в письме недопустима: специальная категория данных
    assert "1990" not in body and "birth" not in body


def test_purchase_letter_points_at_the_paid_matrix(client, monkeypatch):
    """Ссылка «Смотреть разбор» вела на голый /report, а он открывал последнюю запись: покупатель
    второй даты попадал в разбор первой."""
    sent = []
    monkeypatch.setattr(mail, "send", lambda to, subject, body: sent.append((to, subject, body)) or True)
    first = client.post("/api/payments/mock",
                        json={"tariff": "single", "email": "two@example.ru", "birth": "1995-06-20"})
    assert first.status_code == 200
    token = {"Authorization": f"Bearer {first.json()['token']}"}
    saved = client.post("/api/matrices", json={"birth": "1990-01-05", "sex": "m"}, headers=token)
    assert saved.status_code == 200
    second = client.post("/api/payments/mock",
                         json={"tariff": "single", "email": "two@example.ru",
                               "matrix_id": saved.json()["id"]})
    assert second.status_code == 200, second.text

    _, _, body = sent[-1]
    assert f"/report?m={saved.json()['id']}" in body, body


def test_register_sends_letter(client, monkeypatch):
    sent = []
    monkeypatch.setattr(mail, "send", lambda to, subject, body: sent.append((to, subject, body)) or True)
    assert client.post("/api/auth/register",
                       json={"email": "new@example.ru", "password": "1234"}).status_code == 200
    to, subject, body = sent[0]
    assert to == "new@example.ru" and "аккаунт" in subject.lower()
    assert "1234" not in body                    # пароль в переписке не пересылаем


def test_register_survives_broken_smtp(client, monkeypatch):
    monkeypatch.setattr(mail, "enabled", lambda: True)
    monkeypatch.setattr(mail.smtplib, "SMTP", lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("smtp")))
    assert client.post("/api/auth/register",
                       json={"email": "broken@example.ru", "password": "1234"}).status_code == 200


def test_payment_survives_broken_smtp(client, monkeypatch):
    def boom(*_a, **_k):
        raise RuntimeError("smtp упал")
    monkeypatch.setattr(mail.smtplib, "SMTP", boom)
    monkeypatch.setattr(mail, "enabled", lambda: True)
    assert client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "smtp@example.ru", "birth": "1985-03-03"}).status_code == 200


def test_reset_flow(client, auth, db, monkeypatch):
    links = []
    monkeypatch.setattr(mail, "send", lambda to, subject, body: links.append(body) or True)
    auth("who@example.ru")

    assert client.post("/api/auth/reset/request", json={"email": "who@example.ru"}).json()["sent"]
    # в links лежит и письмо о создании аккаунта, ссылка сброса — в том, где есть token
    token = next(b for b in links if "token=" in b).split("token=")[1].split()[0]

    applied = client.post("/api/auth/reset/apply", json={"token": token, "password": "new-pass"})
    assert applied.status_code == 200 and applied.json()["token"]
    assert client.post("/api/auth/login",
                       json={"email": "who@example.ru", "password": "new-pass"}).status_code == 200

    # ссылка одноразовая: после смены пароля её подпись больше не совпадает
    again = client.post("/api/auth/reset/apply", json={"token": token, "password": "third-pass"})
    assert again.status_code == 400 and "использована" in again.json()["detail"]


def test_reset_request_hides_whether_email_exists(client, monkeypatch):
    monkeypatch.setattr(mail, "send", lambda *a, **k: True)
    a = client.post("/api/auth/reset/request", json={"email": "nobody@example.ru"})
    b = client.post("/api/auth/reset/request", json={"email": "NOBODY@example.ru"})
    assert a.json() == b.json() == {"ok": True, "sent": True}


def test_mail_disabled_without_credentials(monkeypatch):
    monkeypatch.setattr(mail.settings, "smtp_user", "")
    assert mail.enabled() is False
    assert mail.send("a@b.ru", "тема", "текст") is False
