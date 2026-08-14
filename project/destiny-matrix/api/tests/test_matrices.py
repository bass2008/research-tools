"""Сохранённые матрицы: хранение — отдельное право, доступ к разбору — тоже."""
from sqlalchemy import select

from app.models import SavedMatrix

BIRTH = {"birth": "1987-06-14", "sex": "m"}


def test_create_and_read_back(client, auth):
    headers = auth("own@example.ru")
    created = client.post("/api/matrices", json=BIRTH, headers=headers)
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["birth"] == "1987-06-14" and body["matrix"]["center"] == 10

    again = client.get(f"/api/matrices/{body['id']}", headers=headers).json()
    assert again["matrix"] == body["matrix"]
    assert client.get("/api/matrices", headers=headers).json()["items"][0]["id"] == body["id"]


def test_title_defaults_to_date(client, auth):
    body = client.post("/api/matrices", json=BIRTH, headers=auth("t@example.ru")).json()
    assert body["title"] == "Матрица 14 июня 1987"


def test_no_token_is_401(client):
    assert client.get("/api/matrices").status_code == 401
    assert client.post("/api/matrices", json=BIRTH).status_code == 401


def test_matrix_belongs_to_owner(client, auth):
    mine = client.post("/api/matrices", json=BIRTH, headers=auth("a@example.ru")).json()
    stranger = auth("b@example.ru")
    # чужая отдаёт 404, а не 403: существование чужих записей знать незачем
    assert client.get(f"/api/matrices/{mine['id']}", headers=stranger).status_code == 404


def test_missing_matrix_is_404(client, auth):
    assert client.get("/api/matrices/9999", headers=auth("m@example.ru")).status_code == 404


def test_second_matrix_needs_storage_right(client, auth):
    """Без права хранения кабинет держит одну матрицу — иначе месячный тариф ничего не даёт."""
    headers = auth("one@example.ru")
    assert client.post("/api/matrices", json=BIRTH, headers=headers).status_code == 200
    refused = client.post("/api/matrices", json={"birth": "1990-01-01", "sex": "f"},
                          headers=headers)
    assert refused.status_code == 402
    detail = refused.json()["detail"]
    assert "Три месяца без ограничений" in detail and isinstance(detail, str)


def test_month_right_allows_many(client, paid):
    headers = paid("month", "many@example.ru")
    for day in range(1, 5):
        r = client.post("/api/matrices", json={"birth": f"1990-01-0{day}", "sex": "f"},
                        headers=headers)
        assert r.status_code == 200, r.text
    assert len(client.get("/api/matrices", headers=headers).json()["items"]) == 4


def test_month_right_unlocks_every_matrix(client, paid):
    headers = paid("month", "unlock@example.ru")
    body = client.post("/api/matrices", json=BIRTH, headers=headers).json()
    assert body["unlocked"] is True
    assert all(s["positions"] for s in body["sections"] if s["access"] == "paid")


def test_single_right_unlocks_only_its_matrix(client, db):
    """Разовая покупка открывает ровно ту дату, за которую заплатили."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "sng@example.ru", **BIRTH}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    bought = client.get(f"/api/matrices/{paid['matrix_id']}", headers=headers).json()
    assert bought["unlocked"] is True

    # вторая дата требует права хранения, поэтому её и сохранить нельзя — доступа тоже нет
    other = client.post("/api/matrices", json={"birth": "1990-01-01", "sex": "f"},
                        headers=headers)
    assert other.status_code == 402


def test_future_date_is_400_and_saves_nothing(client, auth, db):
    headers = auth("fut@example.ru")
    r = client.post("/api/matrices", json={"birth": "2999-01-01", "sex": "f"}, headers=headers)
    assert r.status_code == 400 and "будущем" in r.json()["detail"]
    assert db.scalar(select(SavedMatrix).limit(1)) is None
