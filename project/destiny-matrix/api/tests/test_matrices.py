"""Сохранённые матрицы: хранение — отдельное право, доступ к разбору — тоже."""
from sqlalchemy import select

from app.models import SavedMatrix

BIRTH = {"birth": "1987-06-14", "sex": "m"}


def test_create_and_read_back(client, auth):
    headers = auth("own@example.ru")
    created = client.post("/api/matrices", json=BIRTH, headers=headers)
    assert created.status_code == 200, created.text
    body = created.json()
    # карточка, а не разбор: разделы считает фронт, сервис хранит дату и права
    assert body["birth"] == "1987-06-14" and body["sex"] == "m"
    assert "sections" not in body and "matrix" not in body

    again = client.get(f"/api/matrices/{body['id']}", headers=headers).json()
    assert again["id"] == body["id"] and again["birth"] == body["birth"]
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
    """Бесплатный слот один: вторая дата требует покупки, и в отказе назван продаваемый тариф."""
    headers = auth("one@example.ru")
    assert client.post("/api/matrices", json=BIRTH, headers=headers).status_code == 200
    refused = client.post("/api/matrices", json={"birth": "1990-01-01", "sex": "f"},
                          headers=headers)
    assert refused.status_code == 402
    detail = refused.json()["detail"]
    assert "Полный разбор одной даты" in detail and isinstance(detail, str)


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
    assert body["access"] == "subscription"


def test_single_right_unlocks_only_its_matrix(client, db):
    """Разовая покупка открывает ровно ту дату, за которую заплатили."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "sng@example.ru", **BIRTH}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    bought = client.get(f"/api/matrices/{paid['matrix_id']}", headers=headers).json()
    assert bought["unlocked"] is True

    # вторую дату сохранить можно — бесплатный слот, — но разбор по ней закрыт: за неё не платили
    other = client.post("/api/matrices", json={"birth": "1990-01-01", "sex": "f"},
                        headers=headers)
    assert other.status_code == 200 and other.json()["unlocked"] is False

    # третью не даём: слоты кончились, покупать надо ещё раз
    third = client.post("/api/matrices", json={"birth": "1989-03-03", "sex": "f"},
                        headers=headers)
    assert third.status_code == 402
    detail = third.json()["detail"]
    assert "Мест для хранения дат больше нет" in detail and "занято 2" in detail


def test_future_date_is_400_and_saves_nothing(client, auth, db):
    headers = auth("fut@example.ru")
    r = client.post("/api/matrices", json={"birth": "2999-01-01", "sex": "f"}, headers=headers)
    assert r.status_code == 400 and "будущем" in r.json()["detail"]
    assert db.scalar(select(SavedMatrix).limit(1)) is None


def test_listing_marks_paid_and_locked_dates(client, db):
    """В кабинете видно, какая дата куплена навсегда, а какая закрыта."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "mark@example.ru", "birth": "1993-07-07"}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    bought = paid["matrix"]                       # дату из платежа сервер сохранил сам
    free = client.post("/api/matrices", json={"birth": "1992-02-02", "sex": "f"},
                       headers=headers).json()
    by_id = {row["id"]: row for row in client.get("/api/matrices", headers=headers).json()["items"]}
    assert by_id[bought["id"]]["access"] == "forever"
    assert by_id[bought["id"]]["access_until"] is None
    assert by_id[free["id"]]["access"] == "locked"


def test_subscription_marks_every_date_with_end_date(client, db):
    """Подписка открывает все даты и показывает, до какого числа."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "month", "email": "submark@example.ru"}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    for day in ("01", "02"):
        client.post("/api/matrices", json={"birth": f"1993-03-{day}", "sex": "f"}, headers=headers)
    rows = client.get("/api/matrices", headers=headers).json()["items"]
    assert [r["access"] for r in rows] == ["subscription", "subscription"]
    assert all(r["access_until"] for r in rows)


def test_rename_matrix(client, auth, db):
    """Подпись матрицы правится из кабинета; пустое имя возвращает подпись по умолчанию."""
    headers = auth("name@example.ru")
    row = client.post("/api/matrices", json={"birth": "1991-01-01", "sex": "f"},
                      headers=headers).json()
    named = client.patch(f"/api/matrices/{row['id']}", json={"title": "  Мама  "}, headers=headers)
    assert named.status_code == 200 and named.json()["title"] == "Мама"
    assert client.get("/api/matrices", headers=headers).json()["items"][0]["title"] == "Мама"

    reset = client.patch(f"/api/matrices/{row['id']}", json={"title": ""}, headers=headers)
    assert reset.json()["title"] == "Матрица 1 января 1991"

    # чужую подписать нельзя: её как бы и нет
    other = auth("other-name@example.ru")
    assert client.patch(f"/api/matrices/{row['id']}", json={"title": "чужая"},
                        headers=other).status_code == 404
