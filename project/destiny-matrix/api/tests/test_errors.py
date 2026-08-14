"""Контракт: ошибка — всегда {detail: "текст"}, detail строкой при любом коде."""
import datetime as dt

CASES = [
    ("post", "/api/matrix/calc", {"birth": "нет такой даты"}, None, 422),
    ("post", "/api/matrix/calc",
     {"birth": (dt.date.today() + dt.timedelta(days=2)).isoformat(), "sex": "f"}, None, 400),
    ("get", "/api/auth/me", None, None, 401),
    ("post", "/api/leads", {"email": "nope"}, None, 422),
    ("get", "/api/encyclopedia/arcanum/99", None, None, 404),
]


def test_detail_is_always_a_string(client, auth):
    for method, url, body, headers, code in CASES:
        r = client.request(method.upper(), url, json=body, headers=headers)
        assert r.status_code == code, (url, r.text)
        detail = r.json()["detail"]
        assert isinstance(detail, str) and detail, (url, detail)


def test_limit_402_detail_is_a_string(client, auth):
    headers = auth()
    client.post("/api/matrices", json={"birth": "1987-06-14", "sex": "m"}, headers=headers)
    r = client.post("/api/matrices", json={"birth": "1990-02-02", "sex": "f"}, headers=headers)
    assert r.status_code == 402
    assert isinstance(r.json()["detail"], str)


def test_422_names_broken_fields(client):
    r = client.post("/api/matrix/calc", json={"birth": "1987-06-14", "sex": "x"})
    assert r.status_code == 422
    assert "sex" in r.json()["detail"]
    assert r.json()["errors"][0]["loc"] == ["body", "sex"]
