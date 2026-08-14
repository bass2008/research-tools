from app.security import read_token


def test_register_returns_token_and_user(client):
    r = client.post("/api/auth/register", json={"email": "New@Example.RU", "password": "secret123"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["email"] == "new@example.ru"
    assert read_token(body["token"]) == body["user"]["id"]
    assert "password" not in body["user"] and "password_hash" not in body["user"]


def test_register_twice_is_400(client):
    payload = {"email": "dup@example.ru", "password": "secret123"}
    assert client.post("/api/auth/register", json=payload).status_code == 200
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 400
    assert "уже" in r.json()["detail"]


def test_login_ok_and_wrong_password(client):
    payload = {"email": "log@example.ru", "password": "secret123"}
    client.post("/api/auth/register", json=payload)
    ok = client.post("/api/auth/login", json=payload)
    assert ok.status_code == 200 and ok.json()["token"]
    bad = client.post("/api/auth/login", json={"email": "log@example.ru", "password": "nope123"})
    assert bad.status_code == 401
    missing = client.post("/api/auth/login", json={"email": "ghost@example.ru",
                                                  "password": "secret123"})
    assert missing.status_code == 401


def test_password_is_hashed_not_stored(client, db):
    from sqlalchemy import select

    from app.models import User
    client.post("/api/auth/register", json={"email": "hash@example.ru", "password": "secret123"})
    user = db.scalar(select(User).where(User.email == "hash@example.ru"))
    assert "secret123" not in user.password_hash
    assert user.password_hash.startswith("$bcrypt")


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me",
                      headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_me_reports_access(client, auth):
    """Кабинет спрашивает, что открыто: список прав, а не код тарифа."""
    me = client.get("/api/auth/me", headers=auth("acc@example.ru")).json()
    assert me["access"]["scopes"] == [] and me["matrices_used"] == 0
    assert me["can_store"] is False and me["unlimited"] is False and me["until"] is None

def test_short_password_is_422(client):
    r = client.post("/api/auth/register", json={"email": "s@example.ru", "password": "123"})
    assert r.status_code == 422


def test_broken_email_is_422(client):
    r = client.post("/api/auth/register", json={"email": "not-an-email", "password": "secret123"})
    assert r.status_code == 422
