"""Связь аккаунта с ClientID и доступ к ней только у администратора."""
from sqlalchemy import select

from app.config import settings
from app.models import MetrikaClient, User
from app.security import create_token


def test_clients_are_deduplicated_and_isolated_by_account_and_counter(client, auth, db):
    owner = auth("visits@example.ru")
    uid = client.get("/api/auth/me", headers=owner).json()["user"]["id"]
    payload = {"counter_id": 111856670, "client_id": "1791351251663069918"}
    assert client.post("/api/auth/metrika-client", json=payload, headers=owner).status_code == 200
    first = db.scalars(select(MetrikaClient)).one().first_seen_at
    assert client.post("/api/auth/metrika-client", json=payload, headers=owner).status_code == 200
    db.expire_all()
    row = db.scalars(select(MetrikaClient)).one()
    assert row.first_seen_at == first and row.last_seen_at >= first
    assert row.site_origin == "http://testserver"
    client.post("/api/auth/metrika-client", json={**payload, "client_id": "1791351251663069919"}, headers=owner)
    client.post("/api/auth/metrika-client", json={**payload, "counter_id": 112840069}, headers=owner)
    other = auth("other-visits@example.ru")
    client.post("/api/auth/metrika-client", json=payload, headers=other)
    admin = auth(settings.admins[0])
    rows = client.get(f"/api/admin/users/{uid}/visits", headers=admin).json()["items"]
    assert len(rows) == 3
    assert {r["client_id"] for r in rows} == {payload["client_id"], "1791351251663069919"}
    assert [r["last_seen_at"] for r in rows] == sorted((r["last_seen_at"] for r in rows), reverse=True)
    assert client.get(f"/api/admin/users/{uid}/visits", headers=other).status_code == 404
    assert client.get(f"/api/admin/users/{uid}/visits").status_code == 401
    assert client.get("/api/admin/users/999999/visits", headers=admin).status_code == 404


def test_guest_invalid_and_impersonated_clients_are_not_saved(client, auth, db):
    body = {"counter_id": 111856670, "client_id": "1791351251663069918"}
    assert client.post("/api/auth/metrika-client", json=body).status_code == 401
    owner = auth("ghost-visits@example.ru")
    for bad in ({**body, "client_id": 1791351251663069918}, {**body, "client_id": "bad"},
                {**body, "counter_id": 0}):
        assert client.post("/api/auth/metrika-client", json=bad, headers=owner).status_code == 422
    user = db.scalar(select(User).where(User.email == "ghost-visits@example.ru"))
    ghost = {"Authorization": f"Bearer {create_token(user.id, user.password_hash, ghost=True)}"}
    assert client.post("/api/auth/metrika-client", json=body, headers=ghost).status_code == 200
    assert db.scalars(select(MetrikaClient)).all() == []
    admin = auth(settings.admins[0])
    assert client.get(f"/api/admin/users/{user.id}/visits", headers=admin).json() == {"items": []}
