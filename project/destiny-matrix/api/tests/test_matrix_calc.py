import datetime as dt

MATRIX_KEYS = (
    "day", "month", "year", "mission", "center", "father_line", "mother_line", "descendants",
    "inheritance", "comfort_west", "comfort_north", "comfort_east", "comfort_south", "sky",
    "ground", "social_male", "social_female", "harmony", "planetary", "purpose_personal",
    "purpose_social", "money", "love", "talent", "karmic_tail", "chakras", "chakra_totals",
    "age_scale",
)


def test_anonymous_gets_two_free_sections(client):
    r = client.post("/api/matrix/calc", json={"birth": "1987-06-14", "sex": "m"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["birth"] == "1987-06-14"
    assert body["sex"] == "m"
    assert body["unlocked"] is False
    assert len(body["sections"]) == 20
    free = [s for s in body["sections"] if s["access"] == "free"]
    paid = [s for s in body["sections"] if s["access"] == "paid"]
    # витрина отдаёт три раздела: расчёт бесплатный, толкования — продукт
    assert len(free) == 2 and len(paid) == 18
    assert [s["key"] for s in free] == ["character", "comfort"]
    assert all(s["positions"] for s in free)
    assert all(s["positions"] == [] and "teaser" in s for s in paid)


def test_matrix_matches_engine_and_contract(client):
    r = client.post("/api/matrix/calc", json={"birth": "1987-06-14", "sex": "m"})
    matrix = r.json()["matrix"]
    for key in MATRIX_KEYS:
        assert key in matrix, key
    # контракт: 1987-06-14 → день 14, месяц 6, год 7, миссия 5, центр 10
    assert (matrix["day"], matrix["month"], matrix["year"]) == (14, 6, 7)
    assert matrix["mission"] == 5 and matrix["center"] == 10
    assert len(matrix["chakras"]) == 7 and len(matrix["age_scale"]) == 8
    assert all(1 <= p["arcanum"] <= 22 for p in matrix["age_scale"])
    assert set(matrix["chakra_totals"]) == {"physics", "energy", "emotions"}


def test_positions_link_to_encyclopedia(client):
    r = client.post("/api/matrix/calc", json={"birth": "1990-01-01", "sex": "f"})
    for section in r.json()["sections"]:
        for position in section["positions"]:
            assert position["href"] == f"/encyclopedia/arcanum/{position['arcanum']}"


def test_future_date_is_400(client):
    future = (dt.date.today() + dt.timedelta(days=1)).isoformat()
    r = client.post("/api/matrix/calc", json={"birth": future, "sex": "f"})
    assert r.status_code == 400
    assert "будущем" in r.json()["detail"]


def test_before_1900_is_400(client):
    r = client.post("/api/matrix/calc", json={"birth": "1899-12-31", "sex": "f"})
    assert r.status_code == 400
    assert "1900" in r.json()["detail"]


def test_broken_payload_is_422(client):
    assert client.post("/api/matrix/calc", json={"birth": "14.06.1987"}).status_code == 422
    assert client.post("/api/matrix/calc",
                       json={"birth": "1987-06-14", "sex": "x"}).status_code == 422
    assert client.post("/api/matrix/calc", json={}).status_code == 422


def test_month_right_unlocks_calc(client, paid):
    """Право `all` открывает расчёт любой даты сразу, без сохранения."""
    body = client.post("/api/matrix/calc", json={"birth": "1987-06-14", "sex": "m"},
                       headers=paid("month", "calc@example.ru")).json()
    assert body["unlocked"] is True
    assert all(s["positions"] for s in body["sections"] if s["access"] == "paid")


def test_single_right_does_not_unlock_bare_calc(client):
    """Разовое право живёт на матрице, поэтому расчёт «на лету» им не открывается."""
    paid = client.post("/api/payments/mock", json={"tariff": "single", "email": "sc@example.ru",
                                                  "birth": "1987-06-14", "sex": "m"}).json()
    body = client.post("/api/matrix/calc", json={"birth": "1987-06-14", "sex": "m"},
                       headers={"Authorization": f"Bearer {paid['token']}"}).json()
    assert body["unlocked"] is False
    assert all(not s["positions"] for s in body["sections"] if s["access"] == "paid")
