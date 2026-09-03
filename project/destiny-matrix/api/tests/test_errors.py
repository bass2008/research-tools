"""Контракт: ошибка — всегда {detail: "текст"}, detail строкой при любом коде."""
import datetime as dt

# "own" — заголовок авторизованного: подставляется фикстурой, чтобы кейс не зависел от токена
CASES = [
    ("post", "/api/matrices", {"birth": "нет такой даты"}, "own", 422),
    ("post", "/api/matrices",
     {"birth": (dt.date.today() + dt.timedelta(days=2)).isoformat(), "sex": "f"}, "own", 400),
    ("get", "/api/auth/me", None, None, 401),
    ("post", "/api/auth/register", {"email": "nope", "password": "12345678"}, None, 422),
    ("get", "/api/matrices/999999", None, "own", 404),
]


def test_detail_is_always_a_string(client, auth):
    own = auth("cases@example.ru")
    for method, url, body, headers, code in CASES:
        r = client.request(method.upper(), url, json=body,
                           headers=own if headers == "own" else headers)
        assert r.status_code == code, (url, r.text)
        detail = r.json()["detail"]
        assert isinstance(detail, str) and detail, (url, detail)


def test_limit_402_detail_is_a_string(client, auth):
    headers = auth()
    client.post("/api/matrices", json={"birth": "1987-06-14", "sex": "m"}, headers=headers)
    r = client.post("/api/matrices", json={"birth": "1990-02-02", "sex": "f"}, headers=headers)
    assert r.status_code == 402
    assert isinstance(r.json()["detail"], str)


def test_422_names_broken_fields(client, auth):
    """Человеку — русское имя поля, разработчику — служебное в errors: «Проверьте поля: password»
    не говорило ни что не так, ни что делать."""
    r = client.post("/api/matrices", json={"birth": "1987-06-14", "sex": "x"},
                    headers=auth("fields@example.ru"))
    assert r.status_code == 422
    assert "пол" in r.json()["detail"]
    assert "sex" not in r.json()["detail"]
    assert r.json()["errors"][0]["loc"] == ["body", "sex"]


def test_422_explains_the_limit_it_hit(client):
    """Длина пароля ограничена схемой: отказ обязан назвать границу, а не имя поля."""
    r = client.post("/api/auth/register", json={"email": "a@b.ru", "password": "x" * 300})
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert "пароль" in detail and "200" in detail, detail


def test_422_uses_the_accusative_case_for_email(client):
    """Сообщение формы должно быть нормальным русским, даже если адрес принял браузер,
    но отвергла более строгая серверная схема."""
    r = client.post("/api/auth/register", json={"email": "ivan.@mail.ru", "password": "12345678"})
    assert r.status_code == 422
    assert r.json()["detail"].startswith("Проверьте почту. почта —"), r.json()["detail"]
