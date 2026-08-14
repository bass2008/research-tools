"""Мок-оплата: снимок тарифа, права, автрегистрация."""
import json

from sqlalchemy import select

from app.models import Entitlement, Payment, SavedMatrix, User


def test_month_purchase_grants_all(client, db):
    r = client.post("/api/payments/mock", json={"tariff": "month", "email": "m@example.ru"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] and body["autoregistered"] is True and body["token"]
    assert set(body["entitlement"]["scope"]) == {"single", "matrix", "all"}
    assert body["entitlement"]["expires_at"] is not None      # месяц срочный
    assert body["matrix_id"] is None                          # ко всем датам сразу


def test_single_purchase_binds_matrix(client, db):
    r = client.post("/api/payments/mock", json={"tariff": "single", "email": "s@example.ru",
                                               "birth": "1987-06-14", "sex": "m"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["entitlement"]["scope"] == ["single"]
    assert body["entitlement"]["expires_at"] is None           # разовый бессрочен
    assert body["matrix_id"] is not None
    row = db.scalar(select(SavedMatrix).where(SavedMatrix.id == body["matrix_id"]))
    assert row.birth.isoformat() == "1987-06-14" and row.sex == "m"


def test_payment_keeps_snapshot_of_tariff(client, db):
    r = client.post("/api/payments/mock", json={"tariff": "single", "email": "sn@example.ru",
                                               "birth": "1990-01-01"})
    payment = db.scalar(select(Payment).where(Payment.external_id == r.json()["payment_id"]))
    snapshot = json.loads(payment.tariff_body)
    assert snapshot["id"] == "single" and snapshot["price"] == 10_000
    assert snapshot["scope"] == ["single"] and snapshot["period_days"] is None
    assert payment.amount == 10_000 and payment.paid_at is not None
    assert payment.refunded_at is None


def test_prices_come_from_database(client, db):
    """Цену меняем в базе — витрина и платёж обязаны взять новую, без пересборки кода."""
    listing = {t["id"]: t["price"] for t in client.get("/api/tariffs").json()["items"]}
    assert listing == {"single": 10_000, "month": 24_000}

    from app.models import Tariff
    db.get(Tariff, "single").price = 19_900
    db.commit()

    assert client.get("/api/tariffs").json()["items"][0]["price"] == 19_900
    r = client.post("/api/payments/mock", json={"tariff": "single", "email": "p@example.ru",
                                               "birth": "1990-01-01"})
    payment = db.scalar(select(Payment).where(Payment.external_id == r.json()["payment_id"]))
    assert payment.amount == 19_900


def test_single_without_date_binds_to_first_saved_matrix(client, db):
    """Дата в платёж не уходит, поэтому право приходит без матрицы и находит её при сохранении."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "late@example.ru"}).json()
    assert paid["matrix_id"] is None and paid["entitlement"]["matrix_id"] is None
    headers = {"Authorization": f"Bearer {paid['token']}"}

    saved = client.post("/api/matrices", json={"birth": "1990-02-03", "sex": "f"},
                        headers=headers).json()
    assert saved["unlocked"] is True
    assert all(s["positions"] for s in saved["sections"] if s["access"] == "paid")

    row = db.scalar(select(Entitlement).where(Entitlement.user_id == saved_user(db, "late@example.ru")))
    assert row.matrix_id == saved["id"]


def test_single_without_date_binds_to_existing_matrix(client, auth, db):
    """Кто уже сохранил дату и потом оплатил — получает право на неё, а не пустое."""
    headers = auth("has@example.ru")
    saved = client.post("/api/matrices", json={"birth": "1988-08-08", "sex": "m"},
                        headers=headers).json()
    assert saved["unlocked"] is False

    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "has@example.ru"}).json()
    assert paid["matrix_id"] == saved["id"]
    again = client.get(f"/api/matrices/{saved['id']}", headers=headers).json()
    assert again["unlocked"] is True


def test_second_date_stays_closed_after_single(client, db):
    """Разовое право прилипает к одной дате: месячный тариф остаётся тем, за что платят снова."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "one@example.ru"}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    first = client.post("/api/matrices", json={"birth": "1991-01-01", "sex": "f"},
                        headers=headers).json()
    assert first["unlocked"] is True
    # вторая дата требует права хранения — его у разового нет
    assert client.post("/api/matrices", json={"birth": "1992-02-02", "sex": "f"},
                       headers=headers).status_code == 402


def saved_user(db, email: str) -> int:
    return db.scalar(select(User.id).where(User.email == email))


def test_known_email_gets_right_but_no_token(client, auth):
    """Знание чужой почты не должно давать доступ к её кабинету."""
    auth("known@example.ru")
    r = client.post("/api/payments/mock", json={"tariff": "month", "email": "known@example.ru"})
    body = r.json()
    assert body["autoregistered"] is False
    assert body["token"] is None and body["requires_login"] is True


def test_unknown_tariff_is_404(client):
    r = client.post("/api/payments/mock", json={"tariff": "platinum", "email": "x@example.ru"})
    assert r.status_code == 404
    assert isinstance(r.json()["detail"], str)


def test_payment_ids_are_unique(client):
    first = client.post("/api/payments/mock", json={"tariff": "month", "email": "u@example.ru"})
    second = client.post("/api/payments/mock", json={"tariff": "month", "email": "u@example.ru"})
    assert first.json()["payment_id"] != second.json()["payment_id"]


def test_second_purchase_adds_second_right(client, db):
    """Права накапливаются: месяц поверх разового не отменяет разовое."""
    client.post("/api/payments/mock", json={"tariff": "single", "email": "two@example.ru",
                                            "birth": "1990-01-01"})
    client.post("/api/payments/mock", json={"tariff": "month", "email": "two@example.ru"})
    user = db.scalar(select(User).where(User.email == "two@example.ru"))
    rights = db.scalars(select(Entitlement).where(Entitlement.user_id == user.id)).all()
    assert len(rights) == 2
    assert {tuple(r.scopes()) for r in rights} == {("single",), ("single", "matrix", "all")}


def test_mock_flag_exists_in_settings():
    """Выключатель мок-оплаты есть и по умолчанию включён.

    Проверять отказ через подмену переменной здесь нельзя: настройки кешируются на процесс,
    а приложение читает их при создании. Поведение выключенного мока проверяется на стенде.
    """
    from app.config import Settings
    assert Settings(_env_file=None).mock_payments is True
    assert Settings(_env_file=None, mock_payments=False).mock_payments is False
