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


def test_second_payment_for_the_same_date_is_refused(client, db):
    """Две открытые формы или двойной клик проводили два платежа за одну дату: списывалось
    вдвое, и выдавалось два права на один и тот же разбор."""
    first = client.post("/api/payments/mock", json={"tariff": "single", "email": "dbl@example.ru",
                                                   "birth": "1991-04-09", "sex": "f"})
    assert first.status_code == 200, first.text
    matrix_id = first.json()["matrix_id"]

    again = client.post("/api/payments/mock", json={"tariff": "single", "email": "dbl@example.ru",
                                                   "matrix_id": matrix_id})
    assert again.status_code == 409, again.text
    assert "уже открыт" in again.json()["detail"]

    rights = db.scalars(select(Entitlement).where(Entitlement.matrix_id == matrix_id)).all()
    assert len(rights) == 1, f"прав на одну дату: {len(rights)}"


def test_two_active_rights_for_one_date_are_impossible(client, db):
    """Проверка перед записью гонку не ловит: два параллельных платежа читали «дата закрыта»
    оба. Уникальный индекс переводит гонку в ошибку записи."""
    from sqlalchemy.exc import IntegrityError

    paid = client.post("/api/payments/mock", json={"tariff": "single", "email": "race@example.ru",
                                                   "birth": "1993-07-07", "sex": "f"})
    assert paid.status_code == 200, paid.text
    right = db.scalar(select(Entitlement).where(Entitlement.matrix_id == paid.json()["matrix_id"]))

    twin = Entitlement(user_id=right.user_id, scope=right.scope, matrix_id=right.matrix_id,
                       starts_at=right.starts_at)
    db.add(twin)
    try:
        db.commit()
        raise AssertionError("второе право на ту же дату записалось")
    except IntegrityError:
        db.rollback()


def test_payment_keeps_snapshot_of_tariff(client, db):
    r = client.post("/api/payments/mock", json={"tariff": "single", "email": "sn@example.ru",
                                               "birth": "1990-01-01"})
    payment = db.scalar(select(Payment).where(Payment.external_id == r.json()["payment_id"]))
    snapshot = json.loads(payment.tariff_body)
    assert snapshot["id"] == "single" and snapshot["price"] == 25_000
    assert snapshot["scope"] == ["single"] and snapshot["period_days"] is None
    assert payment.amount == 25_000 and payment.paid_at is not None
    assert payment.refunded_at is None


def test_prices_come_from_database(client, db):
    """Цену меняем в базе — витрина и платёж обязаны взять новую, без пересборки кода."""
    # витрина отдаёт только то, что продаём: подписка в справочнике есть, но скрыта
    listing = {t["id"]: t["price"] for t in client.get("/api/tariffs").json()["items"]}
    assert listing == {"single": 25_000}

    from app.models import Tariff
    db.get(Tariff, "single").price = 19_900
    db.commit()

    assert client.get("/api/tariffs").json()["items"][0]["price"] == 19_900
    r = client.post("/api/payments/mock", json={"tariff": "single", "email": "p@example.ru",
                                               "birth": "1990-01-01"})
    payment = db.scalar(select(Payment).where(Payment.external_id == r.json()["payment_id"]))
    assert payment.amount == 19_900


def test_single_without_target_is_rejected(client, db):
    """Разовый тариф впрок не продаётся: право, которому не к чему прилипнуть, — оплата без разбора."""
    r = client.post("/api/payments/mock", json={"tariff": "single", "email": "late@example.ru"})
    assert r.status_code == 400 and "Укажите дату" in r.json()["detail"]
    # ни платежа, ни пользователя после отказа не остаётся
    assert db.scalar(select(Payment).limit(1)) is None
    assert db.scalar(select(User).where(User.email == "late@example.ru")) is None


def test_single_creates_and_opens_the_date_from_payment(client, db):
    """Дата из платежа сохраняется сразу: разбор открыт с любого устройства, без второго шага."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "now@example.ru",
                             "birth": "1990-02-03", "sex": "f"}).json()
    assert paid["matrix"]["birth"] == "1990-02-03" and paid["entitlement"]["matrix_id"] == paid["matrix_id"]
    headers = {"Authorization": f"Bearer {paid['token']}"}
    saved = client.get(f"/api/matrices/{paid['matrix_id']}", headers=headers).json()
    assert saved["unlocked"] is True and saved["access"] == "forever"


def test_single_without_date_binds_to_existing_matrix(client, auth, db):
    """Кто уже сохранил дату и потом оплатил — получает право на неё, а не пустое."""
    headers = auth("has@example.ru")
    saved = client.post("/api/matrices", json={"birth": "1988-08-08", "sex": "m"},
                        headers=headers).json()
    assert saved["unlocked"] is False

    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "has@example.ru"}).json()
    assert paid["matrix_id"] == saved["id"]      # закрытая дата у аккаунта одна, платить есть за что
    again = client.get(f"/api/matrices/{saved['id']}", headers=headers).json()
    assert again["unlocked"] is True


def test_second_date_stays_closed_after_single(client, db):
    """Разовое право прилипает к одной дате: вторая сохраняется, но остаётся закрытой."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "one@example.ru",
                             "birth": "1991-01-01", "sex": "f"}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    first = client.get(f"/api/matrices/{paid['matrix_id']}", headers=headers).json()
    assert first["unlocked"] is True
    second = client.post("/api/matrices", json={"birth": "1992-02-02", "sex": "f"},
                         headers=headers)
    assert second.status_code == 200 and second.json()["unlocked"] is False


def test_single_bought_twice_opens_two_dates(client, db):
    """Разовый покупают сколько угодно раз: каждая покупка открывает свою дату."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "twice@example.ru",
                             "birth": "1991-01-01", "sex": "f"}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    first = client.get(f"/api/matrices/{paid['matrix_id']}", headers=headers).json()
    assert first["unlocked"] is True

    # вторая покупка называет свою дату и не садится на уже оплаченную
    again = client.post("/api/payments/mock",
                        json={"tariff": "single", "email": "twice@example.ru",
                              "birth": "1992-02-02", "sex": "f"}).json()
    assert again["matrix_id"] != paid["matrix_id"]

    second = client.get(f"/api/matrices/{again['matrix_id']}", headers=headers).json()
    assert second["unlocked"] is True
    # первая дата открытой и осталась: права не переезжают
    assert client.get(f"/api/matrices/{first['id']}", headers=headers).json()["unlocked"] is True

    me = client.get("/api/auth/me", headers=headers).json()
    assert me["matrices_used"] == 2 and me["matrices_limit"] == 3


def test_repeated_save_of_same_date_does_not_spend_slot(client, db):
    """Та же дата второй раз — это то же самое хранилище, а не новая матрица."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "same@example.ru",
                             "birth": "1991-01-01", "sex": "f"}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    first = client.post("/api/matrices", json={"birth": "1991-01-01", "sex": "f"},
                        headers=headers).json()
    again = client.post("/api/matrices", json={"birth": "1991-01-01", "sex": "f"},
                        headers=headers).json()
    assert again["id"] == first["id"] and again["unlocked"] is True
    assert len(client.get("/api/matrices", headers=headers).json()["items"]) == 1


def test_subscription_stores_any_number_of_dates(client, db):
    """Подписка — любое число дат, и все открыты."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "month", "email": "sub@example.ru"}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    for day in range(1, 6):
        row = client.post("/api/matrices", json={"birth": f"1990-01-0{day}", "sex": "f"},
                          headers=headers)
        assert row.status_code == 200 and row.json()["unlocked"] is True
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["matrices_used"] == 5 and me["matrices_limit"] is None



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


def test_payments_listing_shows_own_history(client, auth, db):
    """Кабинет показывает свои платежи со снимком тарифа и не показывает чужие."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "hist@example.ru",
                             "birth": "1990-01-01"}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    client.post("/api/payments/mock", json={"tariff": "month", "email": "hist@example.ru"})
    rows = client.get("/api/payments", headers=headers).json()["items"]
    assert [r["tariff"]["id"] for r in rows] == ["month", "single"]
    assert all(r["paid_at"] and r["refunded_at"] is None for r in rows)
    assert [r["amount"] for r in rows] == [24_000, 25_000]

    stranger = auth("stranger@example.ru")
    assert client.get("/api/payments", headers=stranger).json()["items"] == []


def test_payment_opens_the_chosen_date(client, db):
    """Платёж открывает выбранную дату, а не «последнюю сохранённую».

    Сторож на реальный случай: у пользователя было две даты, он купил разбор, и право село на
    ту, что сохранена позже, — деньги открыли не то, что человек выбирал.
    """
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "pick@example.ru",
                             "birth": "1991-01-01", "sex": "f"}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    first = client.get(f"/api/matrices/{paid['matrix_id']}", headers=headers).json()
    second = client.post("/api/matrices", json={"birth": "1992-02-02", "sex": "m"},
                         headers=headers).json()
    assert first["unlocked"] is True and second["unlocked"] is False

    # покупаем именно вторую — указываем её id
    again = client.post("/api/payments/mock",
                        json={"tariff": "single", "email": "pick@example.ru",
                              "matrix_id": second["id"]}).json()
    assert again["matrix_id"] == second["id"]
    rows = {r["id"]: r for r in client.get("/api/matrices", headers=headers).json()["items"]}
    assert rows[second["id"]]["access"] == "forever"
    assert rows[first["id"]]["access"] == "forever"


def test_payment_for_someone_elses_date_is_404(client, db):
    """Чужую дату оплатить нельзя: её как бы и нет."""
    mine = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "own@example.ru",
                             "birth": "1991-01-01", "sex": "f"}).json()
    r = client.post("/api/payments/mock",
                    json={"tariff": "single", "email": "alien@example.ru",
                          "matrix_id": mine["matrix_id"]})
    assert r.status_code == 404


def test_paying_twice_for_the_same_date_is_rejected(client, db):
    """Открытую дату второй раз не продаём: это оплата за то, что уже есть."""
    paid = client.post("/api/payments/mock",
                       json={"tariff": "single", "email": "dup@example.ru",
                             "birth": "1994-04-04", "sex": "f"}).json()
    by_date = client.post("/api/payments/mock",
                          json={"tariff": "single", "email": "dup@example.ru",
                                "birth": "1994-04-04", "sex": "f"})
    assert by_date.status_code == 409 and "уже открыта" in by_date.json()["detail"]
    by_id = client.post("/api/payments/mock",
                        json={"tariff": "single", "email": "dup@example.ru",
                              "matrix_id": paid["matrix_id"]})
    assert by_id.status_code == 409
    user = db.scalar(select(User).where(User.email == "dup@example.ru"))
    assert len(db.scalars(select(Payment).where(Payment.user_id == user.id)).all()) == 1


def test_every_single_right_has_a_date(client, db):
    """Инвариант: у разового права всегда есть матрица, и платёж помнит ту же."""
    for i, day in enumerate(("05", "06", "07"), start=1):
        client.post("/api/payments/mock", json={"tariff": "single", "email": "inv@example.ru",
                                                "birth": f"1995-05-{day}", "sex": "f"})
    user = db.scalar(select(User).where(User.email == "inv@example.ru"))
    rights = db.scalars(select(Entitlement).where(Entitlement.user_id == user.id)).all()
    payments = db.scalars(select(Payment).where(Payment.user_id == user.id)).all()
    assert len(rights) == 3 and all(r.matrix_id is not None for r in rights)
    assert {p.matrix_id for p in payments} == {r.matrix_id for r in rights}


def test_showcase_knows_whether_money_is_real(client, monkeypatch):
    """Витрина не должна догадываться о провайдере сама: предупреждение «оплата тестовая» было
    вшито в страницу и после подключения банка показывалось людям, у которых списали 250 рублей."""
    from app import payments

    assert client.get("/api/tariffs").json()["test_payments"] is True, "мок — оплата тестовая"

    monkeypatch.setattr(payments.tbank.settings, "tbank_terminal_key", "1234DEMO")
    monkeypatch.setattr(payments.tbank.settings, "tbank_password", "secret")
    monkeypatch.setattr(payments.PROVIDERS["mock"], "enabled", lambda: False)
    assert client.get("/api/tariffs").json()["test_payments"] is False, \
        "с живым терминалом деньги настоящие, предупреждать о тестовом приёме нельзя"
