from app.security import read_token


def test_register_returns_token_and_user(client):
    r = client.post("/api/auth/register", json={"email": "New@Example.RU", "password": "secret123"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["email"] == "new@example.ru"
    assert read_token(body["token"])[0] == body["user"]["id"]
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
    # три знака разрешены, два — нет
    assert client.post("/api/auth/register",
                       json={"email": "s@example.ru", "password": "abc"}).status_code == 200
    r = client.post("/api/auth/register", json={"email": "s2@example.ru", "password": "ab"})
    assert r.status_code == 422


def test_broken_email_is_422(client):
    r = client.post("/api/auth/register", json={"email": "not-an-email", "password": "secret123"})
    assert r.status_code == 422


def test_password_change_ends_open_sessions(client, db, monkeypatch):
    """Смена пароля по ссылке восстановления гасит все ранее выданные сессии."""
    from app import mail
    from app.models import User
    from sqlalchemy import select

    old = client.post("/api/auth/register",
                      json={"email": "kick@example.ru", "password": "first"}).json()["token"]
    headers = {"Authorization": f"Bearer {old}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    links = []
    monkeypatch.setattr(mail, "send", lambda to, subject, body: links.append(body) or True)
    client.post("/api/auth/reset/request", json={"email": "kick@example.ru"})
    token = next(b for b in links if "token=" in b).split("token=")[1].split()[0]
    fresh = client.post("/api/auth/reset/apply",
                        json={"token": token, "password": "second"}).json()["token"]

    # старая сессия больше не работает, новая работает
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {fresh}"}).status_code == 200


def test_reset_link_is_not_a_session(client, db, monkeypatch):
    """Пропуск из письма открывает только смену пароля, а не кабинет."""
    from app import mail

    client.post("/api/auth/register", json={"email": "notsession@example.ru", "password": "first"})
    links = []
    monkeypatch.setattr(mail, "send", lambda to, subject, body: links.append(body) or True)
    client.post("/api/auth/reset/request", json={"email": "notsession@example.ru"})
    token = next(b for b in links if "token=" in b).split("token=")[1].split()[0]

    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert client.get("/api/matrices", headers={"Authorization": f"Bearer {token}"}).status_code == 401
