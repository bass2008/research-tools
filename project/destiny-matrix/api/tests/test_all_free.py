"""Витрина без оплаты: `ALL_FREE_WITHOUT_PAYMENT` открывает разбор всем и закрывает кассу."""
import pytest

from app.config import settings


@pytest.fixture()
def all_free(monkeypatch):
    monkeypatch.setattr(settings, "all_free_without_payment", True)


BIRTH = {"birth": "1987-06-14", "sex": "m"}


def test_off_by_default():
    assert settings.all_free_without_payment is False


def test_saved_matrix_is_open(client, auth, all_free):
    headers = auth("free@example.ru")
    row = client.post("/api/matrices", json=BIRTH, headers=headers).json()
    assert row["unlocked"] is True and row["access"] == "open"
    # витрина открывает доступ, но владением это не становится: покупок у человека нет
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["access"]["scopes"] == [] and me["access"]["owned"] == 0
    assert me["access"]["all_free"] is True and me["matrices_limit"] is None


def test_locked_without_flag(client, auth):
    headers = auth("paidwall@example.ru")
    row = client.post("/api/matrices", json=BIRTH, headers=headers).json()
    assert row["unlocked"] is False and row["access"] == "locked"
    assert client.get("/api/auth/me", headers=headers).json()["access"]["all_free"] is False


def test_storage_limit_lifted(client, auth, all_free):
    headers = auth("many@example.ru")
    for day in range(1, 5):
        created = client.post("/api/matrices", json={"birth": f"1987-06-0{day}", "sex": "f"},
                              headers=headers)
        assert created.status_code == 200, created.text
    assert len(client.get("/api/matrices", headers=headers).json()["items"]) == 4


def test_second_matrix_needs_right_without_flag(client, auth):
    headers = auth("limit@example.ru")
    client.post("/api/matrices", json=BIRTH, headers=headers)
    second = client.post("/api/matrices", json={"birth": "1990-01-01", "sex": "f"},
                         headers=headers)
    assert second.status_code == 402


def test_payment_is_refused(client, all_free):
    body = {"tariff": "single", "email": "buyer@example.ru", **BIRTH}
    assert client.post("/api/payments/mock", json=body).status_code == 409
    assert client.post("/api/payments/start", json=body).status_code == 409


def test_print_is_allowed(client, auth, all_free, monkeypatch):
    """Печать не отвечает «не оплачено»: до неё доходит уже сама печать, а браузера в тестах нет."""
    headers = auth("print@example.ru")
    row = client.post("/api/matrices", json=BIRTH, headers=headers).json()
    answer = client.post("/api/reports/render", json={"matrix_id": row["id"]}, headers=headers)
    assert answer.status_code != 402
