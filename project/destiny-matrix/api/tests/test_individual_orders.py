import json

from sqlalchemy import select

from app import individual_orders as orders
from app.models import Entitlement, IndividualReading, Notification, Purchase, Reading

PRICES = {"first": 1990, "second": 2990, "third": 3590, "next": 1190, "after_three": 1190}

SNAP = {"matrix": {"day": 4}, "sections": []}
PAIR_SNAP = {"matrix": {"p": {}}, "units": []}
TWO = [{"birth": "1992-08-12", "sex": "f"}, {"birth": "1990-09-05", "sex": "m"}]
ONE = [{"kind": "personal", "who": [0]}]
COUPLE = [{"kind": "personal", "who": [0]}, {"kind": "personal", "who": [1]},
          {"kind": "pair", "who": [0, 1], "relation": "Пара"}]


def order(**over) -> dict:
    body = {"email": "buyer@example.ru", "persons": TWO[:1], "readings": ONE, "question": "",
            "snapshots": {"personal_0": SNAP}}
    return {**body, **over}


def test_ladder_and_the_price_after_three(db):
    assert orders.price_list(db) == PRICES
    assert [orders.ladder(n, PRICES) for n in range(6)] == [0, 1990, 2990, 3590, 4780, 5970]
    assert orders.price({"personal": 2, "pair": 1, "year": 0}, 0, PRICES) == 3590
    assert orders.price({"personal": 2, "pair": 1, "year": 0}, 3, PRICES) == 3 * 1190


def test_the_default_year_moves_to_the_next_one_in_july():
    import datetime as dt
    assert orders.default_year(dt.date(2027, 6, 30)) == 2027
    assert orders.default_year(dt.date(2027, 7, 1)) == 2028


def test_the_hidden_offer_is_neither_shown_nor_sold_as_an_ordinary_purchase(client):
    # through the generic payment it would have granted open access to every reading
    response = client.post("/api/payments/mock", json={"tariff": "individual", "email": "x@example.ru"})
    assert response.status_code == 404
    assert "individual" not in [t["id"] for t in client.get("/api/tariffs?product=all").json()["items"]]


def test_a_paid_set_writes_its_requests_once_and_gives_the_automatic_readings(client, db):
    body = order(persons=TWO, readings=COUPLE, question="Как договариваться о деньгах?",
                 snapshots={"personal_0": SNAP, "personal_1": SNAP, "pair_0_1": PAIR_SNAP})
    response = client.post("/api/individual-orders/mock", json=body)
    assert response.status_code == 200, response.text
    assert response.json()["paid"] and response.json()["amount"] == 359_000

    rows = db.scalars(select(IndividualReading).order_by(IndividualReading.id)).all()
    assert [(r.product, r.kind) for r in rows] == [("personal", "personal"), ("personal", "personal"), ("pair", "pair")]
    assert [json.loads(r.inputs).get("birth") for r in rows[:2]] == ["1992-08-12", "1990-09-05"]
    assert all(r.status == "pending" and "Вопрос: Как договариваться о деньгах?" in r.comment for r in rows)
    assert "Кто друг другу: Пара." in rows[2].comment and "Кто друг другу" not in rows[0].comment
    purchase = db.get(Purchase, rows[0].purchase_id)
    assert purchase.amount == 359_000

    # the bank repeats its notification: nothing new is written
    assert orders.fulfil(db, purchase.id) == 0
    assert len(db.scalars(select(IndividualReading)).all()) == 3
    gifts = db.scalars(select(Reading).where(Reading.user_id == purchase.user_id)).all()
    assert sorted(r.product for r in gifts) == ["pair", "personal", "personal"]
    # the order itself is not an access right; its automatic readings are bought, as its parts
    assert db.scalar(select(Entitlement).where(Entitlement.purchase_id == purchase.id)) is None
    parts = db.scalars(select(Purchase).where(Purchase.id != purchase.id)).all()
    assert len(parts) == 3 and all(p.body()["part_of"] == purchase.id and p.amount == 0 for p in parts)
    rights = db.scalars(select(Entitlement).where(Entitlement.purchase_id.in_([p.id for p in parts]))).all()
    assert sorted(r.reading_id for r in rights) == sorted(r.id for r in gifts)
    # one notice for the order; the cabinet history shows the order, not its parts
    assert db.scalar(select(Notification).where(Notification.type == "individual_order_accepted")) is not None
    token = response.json()["token"]
    history = client.get("/api/payments", headers={"Authorization": f"Bearer {token}"}).json()["items"]
    assert len(history) == 1


def test_every_reading_of_a_big_set_goes_to_its_own_people(client, db):
    persons = TWO + [{"birth": "1965-03-01", "sex": "f"}, {"birth": "1991-11-20", "sex": "m"}]
    readings = [{"kind": "personal", "who": [0]}, {"kind": "personal", "who": [1]}, {"kind": "personal", "who": [2]},
                {"kind": "year", "who": [0], "year": 2027}, {"kind": "year", "who": [0], "year": 2028},
                {"kind": "pair", "who": [0, 1]}, {"kind": "pair", "who": [0, 3], "relation": "Друзья"}]
    snaps = {"personal_0": SNAP, "personal_1": SNAP, "personal_2": SNAP, "pair_0_1": PAIR_SNAP, "pair_0_3": PAIR_SNAP}
    response = client.post("/api/individual-orders/mock", json=order(persons=persons, readings=readings, snapshots=snaps))
    assert response.status_code == 200, response.text
    assert response.json()["amount"] == (3590 + 4 * 1190) * 100
    rows = db.scalars(select(IndividualReading).order_by(IndividualReading.id)).all()
    assert [(json.loads(r.inputs).get("birth"), r.year) for r in rows if r.product == "personal"] == [
        ("1992-08-12", None), ("1990-09-05", None), ("1965-03-01", None), ("1992-08-12", 2027), ("1992-08-12", 2028)]
    assert [json.loads(r.inputs)["b"]["birth"] for r in rows if r.product == "pair"] == ["1990-09-05", "1991-11-20"]
    assert not any("Уточнить" in r.comment for r in rows)
    assert "Заказ: личный × 3, пара × 2, год 2027 × 1, год 2028 × 1." in rows[0].comment


def test_after_three_readings_any_next_one_costs_1190(client):
    three = order(persons=TWO + [{"birth": "1965-03-01", "sex": "f"}],
                  readings=[{"kind": "personal", "who": [i]} for i in range(3)],
                  snapshots={f"personal_{i}": SNAP for i in range(3)})
    token = client.post("/api/individual-orders/mock", json=three).json()["token"]
    terms = client.get("/api/individual-orders/terms", headers={"Authorization": f"Bearer {token}"}).json()
    assert terms["bought"] == 3 and terms["default_year"] == orders.default_year() and terms["prices"] == PRICES
    second = client.post("/api/individual-orders/mock", json=order(persons=TWO, readings=[{"kind": "pair", "who": [0, 1]}],
                                                                   snapshots={"pair_0_1": PAIR_SNAP}))
    assert second.status_code == 200, second.text
    assert second.json()["amount"] == 119_000


def test_the_order_is_checked_before_the_money_is_taken(client):
    pair = [{"kind": "pair", "who": [0, 1]}]
    bad = [
        order(readings=pair, snapshots={"pair_0_1": PAIR_SNAP}),           # one date for a couple
        order(persons=TWO, readings=[{"kind": "pair", "who": [0, 0]}], snapshots={"pair_0_0": PAIR_SNAP}),
        order(snapshots={}),                                                # no automatic reading built
        order(readings=[]),
        order(persons=TWO),                                                 # a person no reading is for
        order(readings=ONE * 2),                                            # the same reading twice
        order(readings=[{"kind": "personal", "who": [1]}]),
    ]
    for body in bad:
        assert client.post("/api/individual-orders/mock", json=body).status_code == 422, body


def test_readings_written_free_by_the_admin_do_not_count_towards_three(client, db):
    user = client.post("/api/auth/register", json={"email": "buyer@example.ru", "password": "secret"}).json()
    for _ in range(3):
        db.add(IndividualReading(user_id=user["user"]["id"], product="personal", kind="personal",
                                 inputs="{}", automatic_reading="{}"))
    db.commit()
    response = client.post("/api/individual-orders/mock", json=order())
    assert response.status_code == 200, response.text
    assert response.json()["amount"] == 199_000


def test_the_chosen_year_goes_into_the_request(client, db):
    response = client.post("/api/individual-orders/mock", json=order(readings=[{"kind": "year", "who": [0], "year": 2031}]))
    assert response.status_code == 200, response.text
    assert db.scalar(select(IndividualReading.year)) == 2031


def test_a_childs_matrix_reaches_the_author_and_only_for_a_minor(client, db):
    kid = [{"birth": "2016-04-12", "sex": "f"}]
    response = client.post("/api/individual-orders/mock", json=order(persons=kid, readings=[{"kind": "personal", "who": [0], "child": True}]))
    assert response.status_code == 200, response.text
    row = db.scalars(select(IndividualReading)).one()
    assert json.loads(row.inputs) == {"birth": "2016-04-12", "sex": "f", "child": True}
    assert "Детская матрица" in row.comment
    assert json.loads(db.scalars(select(Reading)).one().inputs) == {"birth": "2016-04-12", "sex": "f"}
    for body in (order(readings=[{"kind": "personal", "who": [0], "child": True}]),
                 order(readings=[{"kind": "year", "who": [0], "year": 2031, "child": True}], persons=kid)):
        assert client.post("/api/individual-orders/mock", json=body).status_code == 422, body


def test_admin_counts_one_payment_for_an_individual_order(client, auth):
    # the order also writes free purchases for its automatic readings; they are not payments
    body = order(persons=TWO, readings=COUPLE, snapshots={"personal_0": SNAP, "personal_1": SNAP, "pair_0_1": PAIR_SNAP})
    assert client.post("/api/individual-orders/mock", json=body).status_code == 200
    from app.config import settings
    rows = client.get("/api/admin/users", headers=auth(settings.admins[0])).json()["items"]
    buyer = next(r for r in rows if r["email"] == "buyer@example.ru")
    assert (buyer["payments"], buyer["spent"]) == (1, 359_000)


def test_order_deadline_counts_from_the_moscow_day():
    import datetime as dt
    from app.individual_orders import order_day
    # 02:30 in Moscow on 10.11 is still 09.11 by the UTC clock of the container.
    assert order_day(dt.datetime(2026, 11, 9, 23, 30, tzinfo=dt.timezone.utc)) == dt.date(2026, 11, 10)
    assert order_day(dt.datetime(2026, 11, 9, 20, 59, tzinfo=dt.timezone.utc)) == dt.date(2026, 11, 9)

