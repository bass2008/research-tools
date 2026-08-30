"""Админка: видит всех, но только админской почтой."""
from __future__ import annotations

from app.config import settings


def test_admin_sees_users_and_payments(client, auth, db):
    # обычный аккаунт с покупкой — он должен попасть в список
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "buyer@example.ru", "birth": "1990-05-05"}).json()
    buyer = {"Authorization": f"Bearer {paid['token']}"}
    # матрицу создал сам платёж: разовый тариф покупают за конкретную дату
    assert paid["matrix"]["birth"] == "1990-05-05"

    admin = auth(settings.admins[0])
    rows = client.get("/api/admin/users", headers=admin).json()["items"]
    by_mail = {r["email"]: r for r in rows}
    assert by_mail[settings.admins[0]]["is_admin"] is True
    assert by_mail["buyer@example.ru"]["matrices"] == 1
    assert by_mail["buyer@example.ru"]["payments"] == 1
    assert by_mail["buyer@example.ru"]["spent"] == 25_000
    assert by_mail["buyer@example.ru"]["owned"] == 1
    assert by_mail["buyer@example.ru"]["last_seen_at"] is None

    payments = client.get("/api/admin/payments", headers=admin).json()["items"]
    assert [p["email"] for p in payments] == ["buyer@example.ru"]

    card = client.get(f"/api/admin/users/{by_mail['buyer@example.ru']['id']}",
                      headers=admin).json()
    assert [m["access"] for m in card["matrices"]] == ["forever"]
    assert len(card["payments"]) == 1 and card["user"]["email"] == "buyer@example.ru"


def test_admin_is_hidden_from_everyone_else(client, auth):
    stranger = auth("nobody@example.ru")
    for path in ("/api/admin/users", "/api/admin/payments", "/api/admin/settings",
                 "/api/admin/users/1"):
        assert client.get(path, headers=stranger).status_code == 404
        assert client.get(path).status_code == 401


def test_me_marks_admin(client, auth):
    admin = auth(settings.admins[0])
    assert client.get("/api/auth/me", headers=admin).json()["is_admin"] is True
    plain = auth("plain@example.ru")
    assert client.get("/api/auth/me", headers=plain).json()["is_admin"] is False


def test_admin_settings_contains_every_field_and_never_full_secrets(client, auth):
    admin = auth(settings.admins[0])
    response = client.get("/api/admin/settings", headers=admin)
    assert response.status_code == 200
    body = response.json()
    rows = {row["name"]: row for row in body["items"]}

    assert body["group"] == "backend"
    assert set(rows) == {name.upper() for name in settings._values}
    assert rows["APP_ENV"]["value"]
    assert rows["JWT_SECRET"]["sensitive"] is True
    assert rows["JWT_SECRET"]["value"] != settings.jwt_secret
    assert settings.jwt_secret not in response.text
    assert client.get("/api/admin/settings").status_code == 401
