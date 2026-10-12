"""Продукты на одной механике: пара покупается, открывается и печатается тем же путём, что и
личный разбор, а права продуктов друг друга не задевают."""
from __future__ import annotations

from sqlalchemy import select

from app.config import settings
from app.models import Entitlement, Payment, Purchase, Reading

PAIR = {"a": {"birth": "1993-03-31", "name": "Сергей"}, "b": {"birth": "1994-12-28", "name": "Виктория"}}


def buy_pair(client, email="pair@example.ru", inputs=PAIR):
    answer = client.post("/api/payments/mock", json={"tariff": "pair", "email": email, "inputs": inputs})
    assert answer.status_code == 200, answer.text
    return answer.json(), {"Authorization": f"Bearer {answer.json()['token']}"}


def test_pair_is_saved_once_whatever_the_order(client, auth):
    headers = auth()
    first = client.post("/api/readings", json={"product": "pair", "inputs": PAIR}, headers=headers)
    assert first.status_code == 200, first.text
    swapped = {"a": PAIR["b"], "b": PAIR["a"]}
    second = client.post("/api/readings", json={"product": "pair", "inputs": swapped}, headers=headers)
    assert second.json()["id"] == first.json()["id"], "A+B и B+A — одна пара"
    body = first.json()
    assert body["product"] == "pair" and body["title"] == "Сергей и Виктория"
    assert body["access"] == "locked" and body["unlocked"] is False


def test_pair_without_names_is_titled_by_dates(client, auth):
    inputs = {"a": {"birth": "1993-03-31"}, "b": {"birth": "1994-12-28"}}
    body = client.post("/api/readings", json={"product": "pair", "inputs": inputs}, headers=auth()).json()
    assert body["title"] == "Пара 31 марта 1993 и 28 декабря 1994"
    en = client.get(f"/api/readings/{body['id']}", headers={**auth("en@example.ru"), "Accept-Language": "en"})
    assert en.status_code == 404, "чужой разбор не виден"


def test_impossible_partner_date_is_400(client, auth):
    bad = {"a": {"birth": "2999-01-01"}, "b": {"birth": "1994-12-28"}}
    answer = client.post("/api/readings", json={"product": "pair", "inputs": bad}, headers=auth())
    assert answer.status_code == 400 and "будущем" in answer.json()["detail"]
    garbage = client.post("/api/readings", json={"product": "pair", "inputs": {"a": "x"}}, headers=auth("g@example.ru"))
    assert garbage.status_code == 400


def test_storefront_is_per_product(client):
    personal = [t["id"] for t in client.get("/api/tariffs").json()["items"]]
    pair = [t["id"] for t in client.get("/api/tariffs?product=pair").json()["items"]]
    assert personal == ["single", "month"], "без продукта — витрина личного разбора, как раньше"
    assert pair == ["pair", "month"]
    month = client.get("/api/tariffs?product=pair").json()["items"][1]
    assert month["products"] == ["*"] and month["per_reading"] is False and month["store_unlimited"] is True


def test_pair_purchase_opens_the_pair_and_nothing_else(client, db):
    body, headers = buy_pair(client)
    assert body["reading"]["product"] == "pair" and body["entitlement"]["products"] == ["pair"]
    pair_id = body["reading_id"]
    assert client.get(f"/api/readings/{pair_id}", headers=headers).json()["unlocked"] is True

    me = client.get("/api/auth/me", headers=headers).json()
    assert me["access"]["scopes"] == [], "купленная пара не делает личный разбор оплаченным"
    assert me["matrices_limit"] == 1 and me["owned"] == 0 and me["unlimited"] is False
    assert me["access"]["products"]["pair"]["owned"] == 1

    date = client.post("/api/matrices", json={"birth": "1993-03-31", "sex": "m"}, headers=headers).json()
    assert date["unlocked"] is False, "право на пару не открывает личную дату"


def test_personal_purchase_does_not_open_a_pair(client):
    answer = client.post("/api/payments/mock", json={"tariff": "single", "email": "solo@example.ru",
                                                    "birth": "1993-03-31", "sex": "m"})
    headers = {"Authorization": f"Bearer {answer.json()['token']}"}
    pair = client.post("/api/readings", json={"product": "pair", "inputs": PAIR}, headers=headers).json()
    assert pair["unlocked"] is False


def test_pair_is_not_sold_twice(client, db):
    body, headers = buy_pair(client, "twice@example.ru")
    again = client.post("/api/payments/mock", json={"tariff": "pair", "email": "twice@example.ru",
                                                   "reading_id": body["reading_id"]})
    assert again.status_code == 409
    swapped = client.post("/api/payments/mock", json={"tariff": "pair", "email": "twice@example.ru",
                                                     "inputs": {"a": PAIR["b"], "b": PAIR["a"]}})
    assert swapped.status_code == 409, "та же пара в другом порядке — тот же разбор"
    assert db.scalar(select(Entitlement).where(Entitlement.reading_id == body["reading_id"])) is not None
    assert len(db.scalars(select(Purchase)).all()) == 1


def test_pair_offer_does_not_accept_a_personal_reading(client, auth):
    headers = auth("mix@example.ru")
    date = client.post("/api/matrices", json={"birth": "1990-01-01", "sex": "f"}, headers=headers).json()
    answer = client.post("/api/payments/mock", json={"tariff": "pair", "email": "mix@example.ru",
                                                    "reading_id": date["id"]})
    assert answer.status_code == 404


def test_subscription_opens_every_product_and_unsaved_calculation(client, db):
    from app import access
    from app.models import User

    answer = client.post("/api/payments/mock", json={"tariff": "month", "email": "all@example.ru"})
    assert answer.status_code == 200, answer.text
    headers = {"Authorization": f"Bearer {answer.json()['token']}"}
    right = answer.json()["entitlement"]
    assert right["products"] == ["*"] and right["per_reading"] is False and right["expires_at"]

    pair = client.post("/api/readings", json={"product": "pair", "inputs": PAIR}, headers=headers).json()
    date = client.post("/api/matrices", json={"birth": "1990-01-01", "sex": "f"}, headers=headers).json()
    assert pair["unlocked"] and pair["access"] == "subscription"
    assert date["unlocked"] and date["access"] == "subscription"

    user = db.scalar(select(User).where(User.email == "all@example.ru"))
    assert access.can_open_unsaved(db, user, "pair") and access.can_open_unsaved(db, user, "personal")
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["unlimited"] is True and me["matrices_limit"] is None and me["can_store"] is True
    for i in range(3):
        extra = {"a": {"birth": f"1980-01-0{i + 1}"}, "b": {"birth": "1981-01-01"}}
        saved = client.post("/api/readings", json={"product": "pair", "inputs": extra}, headers=headers)
        assert saved.status_code == 200, "подписка снимает лимит хранения"


def test_single_right_does_not_open_unsaved_calculation(client, db):
    from app import access
    from app.models import User

    buy_pair(client, "unsaved@example.ru")
    user = db.scalar(select(User).where(User.email == "unsaved@example.ru"))
    assert not access.can_open_unsaved(db, user, "pair")


def test_pair_storage_is_counted_apart_from_dates(client, auth):
    headers = auth("room@example.ru")
    assert client.post("/api/matrices", json={"birth": "1990-01-01", "sex": "f"}, headers=headers).status_code == 200
    first = client.post("/api/readings", json={"product": "pair", "inputs": PAIR}, headers=headers)
    assert first.status_code == 200, "свободное место у каждого продукта своё"
    other = {"a": {"birth": "1980-01-01"}, "b": {"birth": "1981-01-01"}}
    second = client.post("/api/readings", json={"product": "pair", "inputs": other}, headers=headers)
    assert second.status_code == 402 and "Совместимость пары" in second.json()["detail"]


def test_buying_a_saved_pair_frees_room_for_the_next(client, auth):
    headers = auth("next@example.ru")
    saved = client.post("/api/readings", json={"product": "pair", "inputs": PAIR}, headers=headers).json()
    paid = client.post("/api/payments/mock", json={"tariff": "pair", "email": "next@example.ru",
                                                  "reading_id": saved["id"]})
    assert paid.status_code == 200 and paid.json()["reading_id"] == saved["id"]
    other = {"a": {"birth": "1980-01-01"}, "b": {"birth": "1981-01-01"}}
    assert client.post("/api/readings", json={"product": "pair", "inputs": other},
                       headers=headers).status_code == 200


def test_pair_mail_leads_to_the_pair(client, monkeypatch):
    from app import mail
    sent = []
    monkeypatch.setattr(mail, "send", lambda to, subject, body: sent.append(body) or True)
    body, _ = buy_pair(client, "mail@example.ru")
    assert f"/readings/{body['reading_id']}?lang=ru" in sent[-1]


def test_pair_pdf_prints_the_pair_page(client, monkeypatch):
    from app import printing, reports
    calls = []
    monkeypatch.setattr(reports.settings, "browser_url", "http://browser:3001")
    monkeypatch.setattr(reports.settings, "s3_reports_bucket", "bucket")
    monkeypatch.setattr(reports.settings, "s3_access_key", "key")
    monkeypatch.setattr(reports, "render", lambda url: calls.append(url) or b"%PDF-1.4")
    monkeypatch.setattr(reports, "upload", lambda key, pdf: None)
    monkeypatch.setattr(reports, "link", lambda key, filename=None: f"https://files/{key}?name={filename}")

    body, headers = buy_pair(client, "pdf@example.ru")
    answer = client.post("/api/reports/render", json={"reading_id": body["reading_id"]}, headers=headers)
    assert answer.status_code == 200, answer.text
    assert f"/print/pair?r={body['reading_id']}&t=" in calls[0]
    assert "Сергей и Виктория.pdf" in answer.json()["url"]

    token = calls[0].split("&t=")[1].split("&")[0]
    page = client.get(f"/api/reports/page/{body['reading_id']}?t={token}")
    assert page.status_code == 200
    assert page.json()["product"] == "pair" and page.json()["inputs"]["a"]["name"] == "Сергей"
    assert page.json()["unlocked"] is True and page.json()["plan"] == "тариф «Совместимость пары»"
    assert printing.PDF_REVISION in answer.json()["url"]


def test_failed_card_is_retried_inside_the_same_order(client, db, monkeypatch):
    """Карту отклонили — новая попытка того же заказа, а не второй заказ в истории."""
    from app import payments
    from app.payments import Outcome, Started

    attempts = []

    def start(order, amount, name, email, urls):
        attempts.append(order)
        return Started(external_id=f"ext-{len(attempts)}", pay_url=f"https://pay/{len(attempts)}",
                       status="NEW", outcome=Outcome.PENDING)

    mock = payments.PROVIDERS["mock"]
    monkeypatch.setattr(mock, "start", start)
    monkeypatch.setattr(mock, "state", lambda external_id: payments.Update(
        external_id=external_id, order_id=None, outcome=Outcome.FAILED, status="REJECTED"))
    body = {"tariff": "pair", "email": "retry@example.ru", "inputs": PAIR}
    first = client.post("/api/payments/mock", json=body).json()
    second = client.post("/api/payments/mock", json=body).json()
    assert first["purchase_id"] == second["purchase_id"]
    assert first["payment_id"] != second["payment_id"], "отклонённый счёт второй раз не предлагаем"
    assert len(db.scalars(select(Purchase)).all()) == 1
    assert len(db.scalars(select(Payment)).all()) == 2
    headers = {"Authorization": f"Bearer {first['token']}"}
    history = client.get("/api/payments", headers=headers).json()["items"]
    assert len(history) == 1 and history[0]["external_id"] == "ext-2"


def test_admin_grants_a_pair_for_acceptance(client, auth, db):
    buy_pair(client, "target@example.ru")
    target = db.scalar(select(Reading)).user_id
    admin = auth(settings.admins[0])
    other = {"a": {"birth": "1970-07-07", "name": "А"}, "b": {"birth": "1971-08-08", "name": "Б"}}
    answer = client.post(f"/api/admin/users/{target}/readings", json={"product": "pair", "inputs": other},
                         headers=admin)
    assert answer.status_code == 200, answer.text
    assert answer.json()["access"] == "granted"
    card = client.get(f"/api/admin/users/{target}", headers=admin).json()
    assert {r["product"] for r in card["readings"]} == {"pair"}
    assert card["matrices"] == [], "в прежнем списке дат пар нет"


def test_active_subscription_is_not_sold_again(client, db):
    """Аудит 09.10: вторая подписка списывала 240 ₽ и не продлевала срок."""
    first = client.post("/api/payments/mock", json={"tariff": "month", "email": "sub-twice@example.ru"})
    assert first.status_code == 200, first.text
    again = client.post("/api/payments/mock", json={"tariff": "month", "email": "sub-twice@example.ru"})
    assert again.status_code == 409 and "Подписка уже действует до" in again.json()["detail"]
    pair = client.post("/api/payments/mock", json={"tariff": "pair", "email": "sub-twice@example.ru", "inputs": PAIR})
    assert pair.status_code == 409, "пару, открытую подпиской, не продаём"
    assert len(db.scalars(select(Purchase)).all()) == 1
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {first.json()['token']}"}).json()
    assert me["access"]["products"]["pair"]["unlimited"] is True


def test_admin_grants_a_subscription_to_anyone(client, auth, db):
    from app.models import User
    target = auth("gift@example.ru")
    admin = auth(settings.admins[0])
    user_id = db.scalar(select(User).where(User.email == "gift@example.ru")).id
    first = client.post(f"/api/admin/users/{user_id}/subscription", headers=admin)
    assert first.status_code == 200, first.text
    assert first.json()["already"] is False and first.json()["until"]
    assert first.json()["products"]["pair"]["unlimited"] and first.json()["products"]["personal"]["unlimited"]
    again = client.post(f"/api/admin/users/{user_id}/subscription", headers=admin)
    assert again.json()["already"] is True, "вторая выдача не плодит права"
    rights = db.scalars(select(Entitlement).where(Entitlement.user_id == user_id)).all()
    assert len(rights) == 1 and rights[0].purchase_id is None and rights[0].note == "выдана админом"
    pair = client.post("/api/readings", json={"product": "pair", "inputs": PAIR}, headers=target).json()
    assert pair["unlocked"] and pair["access"] == "subscription"
    stranger = client.post(f"/api/admin/users/{user_id}/subscription", headers=auth("nobody@example.ru"))
    assert stranger.status_code == 404, "не админ"


def test_admin_grant_outlives_the_subscription(client, auth, db):
    """Аудит 09.10: выданное подписчику держалось на подписке и закрывалось вместе с ней."""
    from app.models import User, utcnow
    paid = client.post("/api/payments/mock", json={"tariff": "month", "email": "sub-gift@example.ru"})
    token = {"Authorization": f"Bearer {paid.json()['token']}"}
    user_id = db.scalar(select(User).where(User.email == "sub-gift@example.ru")).id
    admin = auth(settings.admins[0])
    pair = client.post(f"/api/admin/users/{user_id}/readings", json={"product": "pair", "inputs": PAIR},
                       headers=admin).json()
    date = client.post(f"/api/admin/users/{user_id}/matrices", json={"birth": "1977-04-03", "sex": "f"},
                       headers=admin).json()
    assert pair["access"] == "granted" and date["access"] == "granted"
    for right in db.scalars(select(Entitlement).where(Entitlement.user_id == user_id,
                                                      Entitlement.per_reading.is_(False))):
        right.revoked_at = utcnow()
    db.commit()
    items = {r["id"]: r for r in client.get("/api/readings?product=pair", headers=token).json()["items"]}
    assert items[pair["id"]]["access"] == "granted"
    assert client.get(f"/api/readings/{pair['id']}", headers=token).json()["unlocked"] is True


def test_granted_subscription_is_told_apart_from_a_bought_one(client, auth, db):
    from app.models import User
    bought = client.post("/api/payments/mock", json={"tariff": "month", "email": "sub-bought@example.ru"})
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {bought.json()['token']}"}).json()
    assert me["access"]["products"]["personal"]["unlimited_granted"] is False
    target = auth("sub-given@example.ru")
    user_id = db.scalar(select(User).where(User.email == "sub-given@example.ru")).id
    client.post(f"/api/admin/users/{user_id}/subscription", headers=auth(settings.admins[0]))
    me = client.get("/api/auth/me", headers=target).json()
    assert me["access"]["products"]["personal"]["unlimited_granted"] is True


def _refund_all(client, admin, db, user_id):
    for payment in db.scalars(select(Payment).where(Payment.user_id == user_id)).all():
        assert client.post(f"/api/admin/payments/{payment.id}/refund", headers=admin).status_code == 200


def test_admin_grant_over_a_purchase_survives_its_refund(client, auth, db):
    """Аудит 09.10 (третий): выдача поверх купленного не создавала права, и возврат закрывал разбор."""
    from app.models import User
    _, token = buy_pair(client, "bought-gift@example.ru")
    user_id = db.scalar(select(User).where(User.email == "bought-gift@example.ru")).id
    admin = auth(settings.admins[0])
    flipped = {"a": PAIR["b"], "b": PAIR["a"]}
    pair = client.post(f"/api/admin/users/{user_id}/readings", json={"product": "pair", "inputs": flipped},
                       headers=admin).json()
    assert pair["access"] == "forever", "пока покупка действует, разбор показывается купленным"
    again = client.post(f"/api/admin/users/{user_id}/readings", json={"product": "pair", "inputs": PAIR},
                        headers=admin).json()
    assert again["id"] == pair["id"]
    rights = db.scalars(select(Entitlement).where(Entitlement.reading_id == pair["id"],
                                                  Entitlement.revoked_at.is_(None))).all()
    assert sorted(r.purchase_id is None for r in rights) == [False, True], "одно купленное и одно выданное"
    me = client.get("/api/auth/me", headers=token).json()["access"]["products"]["pair"]
    assert (me["owned"], me["granted"]) == (1, 0), "разбор считается один раз"

    _refund_all(client, admin, db, user_id)
    item = client.get(f"/api/readings/{pair['id']}", headers=token).json()
    assert item["unlocked"] is True and item["access"] == "granted"


def test_admin_subscription_over_a_paid_one_survives_its_refund(client, auth, db):
    from app.models import User
    paid = client.post("/api/payments/mock", json={"tariff": "month", "email": "paid-sub-gift@example.ru"})
    token = {"Authorization": f"Bearer {paid.json()['token']}"}
    user_id = db.scalar(select(User).where(User.email == "paid-sub-gift@example.ru")).id
    admin = auth(settings.admins[0])
    first = client.post(f"/api/admin/users/{user_id}/subscription", headers=admin).json()
    assert first["already"] is False
    assert client.post(f"/api/admin/users/{user_id}/subscription", headers=admin).json()["already"] is True
    _refund_all(client, admin, db, user_id)
    me = client.get("/api/auth/me", headers=token).json()["access"]["products"]["personal"]
    assert me["unlimited"] is True and me["unlimited_granted"] is True


def test_admin_list_counts_every_product(client, auth, db):
    from app.models import User
    buy_pair(client, "pair-only@example.ru")
    user_id = db.scalar(select(User).where(User.email == "pair-only@example.ru")).id
    row = client.get(f"/api/admin/users/{user_id}", headers=auth(settings.admins[0])).json()["user"]
    assert row["owned"] == 0, "верхние поля — про личный разбор"
    assert row["products"]["pair"]["owned"] == 1


def _holdings(client, headers):
    return client.get("/api/auth/me", headers=headers).json()["access"]["holdings"]


def test_holdings_name_every_kind_of_right_once(client, auth, db):
    """Аудит 09.10 (четвёртый): строка «Доступ» собиралась из полей личного разбора, и у пары и у
    выданного всякий раз находилась непокрытая комбинация. Теперь сводка одна."""
    from app.models import User
    admin = auth(settings.admins[0])
    _, token = buy_pair(client, "holder@example.ru")
    user_id = db.scalar(select(User).where(User.email == "holder@example.ru")).id
    assert _holdings(client, token) == [{"kind": "reading", "source": "bought", "product": "pair", "count": 1}]

    client.post(f"/api/admin/users/{user_id}/readings", json={"product": "pair", "inputs": PAIR}, headers=admin)
    client.post(f"/api/admin/users/{user_id}/matrices", json={"birth": "1988-08-08", "sex": "f"}, headers=admin)
    assert _holdings(client, token) == [
        {"kind": "reading", "source": "granted", "product": "personal", "count": 1},
        {"kind": "reading", "source": "bought", "product": "pair", "count": 1},
    ], "пара с купленным и выданным правом — одна купленная"

    client.post(f"/api/admin/users/{user_id}/subscription", headers=admin)
    first = _holdings(client, token)[0]
    assert first["kind"] == "subscription" and first["source"] == "granted" and first["until"]
    assert first["products"] == ["*"]

    row = client.get(f"/api/admin/users/{user_id}", headers=admin).json()["user"]
    assert row["holdings"] == _holdings(client, token)


def test_plan_label_says_how_the_reading_is_open(client, auth, db):
    from app.models import User
    target = auth("labels@example.ru")
    admin = auth(settings.admins[0])
    user_id = db.scalar(select(User).where(User.email == "labels@example.ru")).id
    granted = client.post(f"/api/admin/users/{user_id}/matrices", json={"birth": "1988-08-08", "sex": "f"},
                          headers=admin).json()
    assert client.get(f"/api/matrices/{granted['id']}", headers=target).json()["plan"] == "выдан бесплатно"
    client.post(f"/api/admin/users/{user_id}/subscription", headers=admin)
    saved = client.post("/api/readings", json={"product": "personal", "inputs": {"birth": "1990-01-01", "sex": "m"}},
                        headers=target).json()
    card = client.get(f"/api/matrices/{saved['id']}", headers=target).json()
    assert card["plan"] == "выдан бесплатно", "выданная подписка подписывается выданной"
    assert card["access"] == "subscription" and card["access_granted"] is True

    paid = client.post("/api/payments/mock", json={"tariff": "month", "email": "labels-paid@example.ru"})
    buyer = {"Authorization": f"Bearer {paid.json()['token']}"}
    mine = client.post("/api/readings", json={"product": "personal", "inputs": {"birth": "1990-01-01", "sex": "m"}},
                       headers=buyer).json()
    card = client.get(f"/api/matrices/{mine['id']}", headers=buyer).json()
    assert card["plan"] == "тариф «Подписка на 3 месяца»" and card["access_granted"] is False
    holding = client.get("/api/auth/me", headers=buyer).json()["access"]["holdings"][0]
    assert holding["name"] == "Подписка на 3 месяца", "имя подписки приходит в сводке"


def test_repeated_grant_is_reported_as_nothing_new(client, auth, db):
    from app.models import User
    auth("again@example.ru")
    admin = auth(settings.admins[0])
    user_id = db.scalar(select(User).where(User.email == "again@example.ru")).id
    body = {"birth": "1984-03-17", "sex": "m"}
    assert client.post(f"/api/admin/users/{user_id}/matrices", json=body, headers=admin).json()["granted_now"] is True
    assert client.post(f"/api/admin/users/{user_id}/matrices", json=body, headers=admin).json()["granted_now"] is False
    pair = {"product": "pair", "inputs": PAIR}
    flipped = {"product": "pair", "inputs": {"a": PAIR["b"], "b": PAIR["a"]}}
    assert client.post(f"/api/admin/users/{user_id}/readings", json=pair, headers=admin).json()["granted_now"] is True
    assert client.post(f"/api/admin/users/{user_id}/readings", json=flipped, headers=admin).json()["granted_now"] is False


def test_receipt_tells_what_the_refund_left_and_names_a_subscription(client, auth, db):
    """Аудит 09.10 на тесте: чек возврата писал «разбор закрыт, оплатите снова», хотя разбор
    оставался открытым подпиской; чек подписки без даты обещал «разбор сохранён в кабинете»."""
    from app.models import User
    paid = client.post("/api/payments/mock", json={"tariff": "single", "email": "receipt@example.ru",
                                                  "birth": "1990-01-01", "sex": "m"}).json()
    token = {"Authorization": f"Bearer {paid['token']}"}
    user_id = db.scalar(select(User).where(User.email == "receipt@example.ru")).id
    admin = auth(settings.admins[0])
    client.post(f"/api/admin/users/{user_id}/subscription", headers=admin)
    payment = db.scalar(select(Payment).where(Payment.user_id == user_id))
    client.post(f"/api/admin/payments/{payment.id}/refund", headers=admin)

    receipt = client.post("/api/payments/sync", json={"order_id": paid["order_id"]}, headers=token).json()
    assert receipt["state"] == "refunded" and receipt["still_open"] is True
    assert receipt["outcome"].startswith("Разбор этой даты остаётся открытым по подписке до ")

    month = client.post("/api/payments/mock", json={"tariff": "month", "email": "receipt-sub@example.ru"}).json()
    sub = client.post("/api/payments/sync", json={"order_id": month["order_id"]},
                      headers={"Authorization": f"Bearer {month['token']}"}).json()
    assert sub["subscription"] is True and sub["matrix_id"] is None and sub["until"]


def test_refund_with_nothing_left_offers_to_pay_again(client, auth, db):
    from app.models import User
    paid = client.post("/api/payments/mock", json={"tariff": "single", "email": "closed@example.ru",
                                                  "birth": "1990-01-01", "sex": "m"}).json()
    user_id = db.scalar(select(User).where(User.email == "closed@example.ru")).id
    payment = db.scalar(select(Payment).where(Payment.user_id == user_id))
    client.post(f"/api/admin/payments/{payment.id}/refund", headers=auth(settings.admins[0]))
    receipt = client.post("/api/payments/sync", json={"order_id": paid["order_id"]},
                          headers={"Authorization": f"Bearer {paid['token']}"}).json()
    assert receipt["still_open"] is False and receipt["outcome"] == "Разбор этой даты закрыт."
