"""Эквайринг: подпись, начало оплаты и обработка уведомлений. Сеть не трогаем — вызовы к банку
подменяются, потому что проверяется наша половина: подпись, идемпотентность, отзыв прав."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app import payments
from app.payments.tbank import Tbank
from app.models import Entitlement, Payment


BANK = Tbank()

DOC_EXAMPLE = {"TerminalKey": "MerchantTerminalKey", "Amount": 19200, "OrderId": "00000",
               "Description": "Подарочная карта на 1000 рублей"}


def test_token_matches_documented_example():
    assert BANK.token(DOC_EXAMPLE, "11111111111111") == \
        "72dd466f8ace0a37a1f740ce5fb78101712bc0665d91a8108c7c8a0ccd426db2"


def test_token_ignores_nested_objects():
    with_nested = {**DOC_EXAMPLE, "DATA": {"Email": "a@b.ru"}, "Receipt": {"Items": []}}
    assert BANK.token(with_nested, "11111111111111") == BANK.token(DOC_EXAMPLE, "11111111111111")


@pytest.fixture
def bank(monkeypatch):
    monkeypatch.setattr(payments.tbank.settings, "tbank_terminal_key", "1234DEMO")
    monkeypatch.setattr(payments.tbank.settings, "tbank_password", "secret")
    monkeypatch.setattr(payments.PROVIDERS["mock"], "enabled", lambda: False)
    calls = []

    def fake_call(method, payload):
        calls.append((method, payload))
        if method == "Init":
            # номер у каждого счёта свой, как у настоящего банка: колонка external_id уникальна,
            # и повторная выдача одного номера ломала сценарии с двумя платежами
            number = 900_000 + sum(1 for m, _ in calls if m == "Init")
            return {"Success": True, "PaymentId": str(number), "Status": "NEW",
                    "PaymentURL": f"https://pay.tbank.ru/xyz{number}", "OrderId": payload["OrderId"]}
        if method == "GetState":
            return {"Success": True, "Status": "CONFIRMED", "PaymentId": payload["PaymentId"]}
        return {"Success": True}

    monkeypatch.setattr(payments.PROVIDERS["tbank"], "call", fake_call)
    return calls


def signed(fields: dict) -> dict:
    return {**fields, "Token": BANK.token(fields)}


def start(client, email="buy@example.ru", birth="1990-01-01"):
    r = client.post("/api/payments/start",
                    json={"tariff": "single", "email": email, "birth": birth})
    assert r.status_code == 200, r.text
    return r.json()


def test_start_creates_pending_payment(client, db, bank):
    body = start(client)
    assert body["payment_url"].startswith("https://pay.tbank.ru/xyz") and body["status"] == "NEW"
    payment = db.scalars(select(Payment)).one()
    assert payment.provider == "tbank" and payment.status == "NEW" and payment.paid_at is None
    # права до оплаты нет: их выдаёт уведомление банка
    assert db.scalars(select(Entitlement)).all() == []
    method, payload = bank[0]
    assert method == "Init" and payload["OrderId"].startswith(f"arcana-{payment.id}-")
    assert payload["Amount"] == 25_000
    assert payload["NotificationURL"].endswith("/api/payments/notify/tbank")


def test_notification_opens_access_once(client, db, bank):
    body = start(client, "once@example.ru")
    note = signed({"TerminalKey": "1234DEMO", "OrderId": body["order_id"], "Success": True,
                   "Status": "CONFIRMED", "PaymentId": body["payment_id"], "Amount": 25_000})
    assert client.post("/api/payments/notify", json=note).json()["status"] == "CONFIRMED"
    assert client.post("/api/payments/notify", json=note).status_code == 200

    payment = db.scalars(select(Payment)).one()
    rights = db.scalars(select(Entitlement)).all()
    assert payment.paid_at is not None and len(rights) == 1
    assert rights[0].matrix_id == payment.matrix_id


def test_authorized_then_confirmed_gives_one_right(client, db, bank):
    body = start(client, "two@example.ru")
    for state in ("AUTHORIZED", "CONFIRMED"):
        note = signed({"TerminalKey": "1234DEMO", "OrderId": body["order_id"], "Success": True,
                       "Status": state, "PaymentId": body["payment_id"], "Amount": 25_000})
        assert client.post("/api/payments/notify", json=note).status_code == 200
    assert len(db.scalars(select(Entitlement)).all()) == 1


def test_notification_without_valid_token_is_rejected(client, db, bank):
    body = start(client, "forged@example.ru")
    forged = {"TerminalKey": "1234DEMO", "OrderId": body["order_id"], "Success": True,
              "Status": "CONFIRMED", "PaymentId": body["payment_id"], "Token": "мусор"}
    assert client.post("/api/payments/notify", json=forged).status_code == 403
    assert db.scalars(select(Entitlement)).all() == []


def test_refund_revokes_access(client, db, bank):
    body = start(client, "back@example.ru")
    for state in ("CONFIRMED", "REFUNDED"):
        note = signed({"TerminalKey": "1234DEMO", "OrderId": body["order_id"], "Success": True,
                       "Status": state, "PaymentId": body["payment_id"], "Amount": 25_000})
        client.post("/api/payments/notify", json=note)
    payment = db.scalars(select(Payment)).one()
    right = db.scalars(select(Entitlement)).one()
    assert payment.refunded_at is not None and right.revoked_at is not None
    assert right.active() is False


def test_sync_asks_the_bank(client, db, bank):
    body = start(client, "sync@example.ru")
    headers = {"Authorization": f"Bearer {body['token']}"}
    answer = client.post("/api/payments/sync", json={"order_id": body["order_id"]},
                         headers=headers).json()
    assert answer["status"] == "CONFIRMED" and answer["paid"] is True
    assert ("GetState", {"PaymentId": body["payment_id"]}) in bank


def test_start_needs_credentials(client, monkeypatch):
    monkeypatch.setattr(payments.tbank.settings, "tbank_terminal_key", "")
    monkeypatch.setattr(payments.PROVIDERS["mock"], "enabled", lambda: False)
    r = client.post("/api/payments/start",
                    json={"tariff": "single", "email": "off@example.ru", "birth": "1990-01-01"})
    assert r.status_code == 503


def test_admin_refund_revokes_access(client, auth, db, bank, monkeypatch):
    from app.config import settings

    body = start(client, "refund@example.ru")
    note = signed({"TerminalKey": "1234DEMO", "OrderId": body["order_id"], "Success": True,
                   "Status": "CONFIRMED", "PaymentId": body["payment_id"], "Amount": 25_000})
    client.post("/api/payments/notify", json=note)

    monkeypatch.setattr(payments.PROVIDERS["tbank"], "cancel",
                        lambda pid: payments.Update(external_id=pid, order_id=None,
                                                    outcome=payments.Outcome.REFUNDED,
                                                    status="REVERSED"))
    payment = db.scalars(select(Payment)).one()
    admin = auth(settings.admins[0])
    r = client.post(f"/api/admin/payments/{payment.id}/refund", headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "REVERSED"

    db.refresh(payment)
    right = db.scalars(select(Entitlement)).one()
    assert payment.refunded_at is not None and right.revoked_at is not None


def test_refund_is_admin_only(client, auth, db, bank):
    body = start(client, "notadmin@example.ru")
    payment = db.scalars(select(Payment)).one()
    stranger = auth("stranger@example.ru")
    assert client.post(f"/api/admin/payments/{payment.id}/refund", headers=stranger).status_code == 404


def test_router_does_not_know_the_bank():
    """Сторож изоляции: в роутере платежей нет ни одного упоминания провайдера, кроме адреса
    уведомления, оставленного для совместимости."""
    import inspect

    from app.routers import admin as admin_module
    from app.routers import payments as router_module
    source = inspect.getsource(router_module)
    assert source.count("tbank") == 1 and 'notify("tbank"' in source
    assert "AUTHORIZED" not in source and "CONFIRMED" not in source
    admin = inspect.getsource(admin_module)
    assert "tbank" not in admin


def test_outcomes_cover_every_status():
    from app.payments.tbank import outcome_of

    assert outcome_of("CONFIRMED") is payments.Outcome.PAID
    assert outcome_of("AUTHORIZED") is payments.Outcome.PAID
    assert outcome_of("REVERSED") is payments.Outcome.REFUNDED
    assert outcome_of("PARTIAL_REFUNDED") is payments.Outcome.REFUNDED
    assert outcome_of("REJECTED") is payments.Outcome.FAILED
    assert outcome_of("DEADLINE_EXPIRED") is payments.Outcome.FAILED
    assert outcome_of("NEW") is payments.Outcome.PENDING
    assert outcome_of("FORM_SHOWED") is payments.Outcome.PENDING


def test_mock_provider_pays_at_once(client, db):
    r = client.post("/api/payments/start",
                    json={"tariff": "single", "email": "mockpay@example.ru", "birth": "1990-03-03"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provider"] == "mock" and body["paid"] is True and body["payment_url"] is None
    payment = db.scalars(select(Payment)).one()
    assert payment.paid_at is not None
    assert db.scalars(select(Entitlement)).one().payment_id == payment.id


def test_second_provider_plugs_in_without_touching_the_router(client, db, monkeypatch):
    """Проверка расширяемости: свой провайдер, зарегистрированный в реестре, работает целиком —
    начало оплаты, уведомление, выдача прав."""
    class Fake:
        name = "fake"

        def enabled(self):
            return True

        def start(self, order_id, amount, title, email):
            return payments.Started(external_id=f"fake-{order_id}", pay_url="https://fake/pay",
                                    status="created")

        def state(self, external_id):
            return payments.Update(external_id, None, payments.Outcome.PAID, "succeeded")

        def cancel(self, external_id):
            return payments.Update(external_id, None, payments.Outcome.REFUNDED, "canceled")

        def read_notification(self, body):
            return payments.Update(str(body.get("id")), None, payments.Outcome.PAID, "succeeded")

    monkeypatch.setitem(payments.PROVIDERS, "fake", Fake())
    monkeypatch.setattr(payments.PROVIDERS["mock"], "enabled", lambda: False)
    monkeypatch.setattr(payments.PROVIDERS["tbank"], "enabled", lambda: False)

    body = client.post("/api/payments/start",
                       json={"tariff": "single", "email": "fake@example.ru",
                             "birth": "1991-04-04"}).json()
    assert body["provider"] == "fake" and body["payment_url"] == "https://fake/pay"
    assert body["paid"] is False and db.scalars(select(Entitlement)).all() == []

    note = client.post("/api/payments/notify/fake", json={"id": body["payment_id"]})
    assert note.status_code == 200 and note.json()["status"] == "succeeded"
    assert db.scalars(select(Entitlement)).one().payment_id == db.scalars(select(Payment)).one().id


def paid_once(client, bank, email="ref@example.ru", birth="1992-02-02"):
    body = start(client, email, birth)
    note = signed({"TerminalKey": "1234DEMO", "OrderId": body["order_id"], "Success": True,
                   "Status": "CONFIRMED", "PaymentId": body["payment_id"], "Amount": 25_000})
    client.post("/api/payments/notify", json=note)
    return body


def refund_note(body, status="REFUNDED"):
    return signed({"TerminalKey": "1234DEMO", "OrderId": body["order_id"], "Success": True,
                   "Status": status, "PaymentId": body["payment_id"], "Amount": 25_000})


def test_refund_closes_the_report_and_pdf(client, db, bank, monkeypatch):
    """После возврата разбор снова закрыт, а печать PDF отвечает «не оплачено»."""
    body = paid_once(client, bank, "closed@example.ru")
    headers = {"Authorization": f"Bearer {body['token']}"}
    matrix_id = body["matrix_id"]
    assert client.get(f"/api/matrices/{matrix_id}", headers=headers).json()["unlocked"] is True

    client.post("/api/payments/notify", json=refund_note(body))

    fresh = client.get(f"/api/matrices/{matrix_id}", headers=headers).json()
    assert fresh["unlocked"] is False and fresh["access"] == "locked"
    assert client.post("/api/reports/render", json={"matrix_id": matrix_id},
                       headers=headers).status_code == 402


def test_refund_keeps_the_saved_date(client, db, bank):
    """Возврат снимает доступ, но дату из кабинета не удаляет: человек её сохранял сам."""
    body = paid_once(client, bank, "keep@example.ru")
    headers = {"Authorization": f"Bearer {body['token']}"}
    client.post("/api/payments/notify", json=refund_note(body))

    rows = client.get("/api/matrices", headers=headers).json()["items"]
    assert [row["id"] for row in rows] == [body["matrix_id"]]
    assert rows[0]["access"] == "locked"


def test_repeated_refund_changes_nothing(client, db, bank, monkeypatch):
    letters = []
    monkeypatch.setattr("app.mail.send", lambda to, subject, text: letters.append(subject) or True)
    body = paid_once(client, bank, "twice-back@example.ru")

    for _ in range(3):
        assert client.post("/api/payments/notify", json=refund_note(body)).status_code == 200

    payment = db.scalars(select(Payment)).one()
    rights = db.scalars(select(Entitlement)).all()
    assert len(rights) == 1 and rights[0].revoked_at is not None
    stamp = payment.refunded_at
    client.post("/api/payments/notify", json=refund_note(body, "REVERSED"))
    db.refresh(payment)
    assert payment.refunded_at == stamp, "время возврата переписалось"
    assert sum("возвращ" in subject.lower() for subject in letters) == 1, letters


def test_refund_before_payment_is_harmless(client, db, bank):
    """Отмена неоплаченного платежа: прав не было, письма нет, статус меняется."""
    body = start(client, "early@example.ru")
    assert client.post("/api/payments/notify",
                       json=refund_note(body, "REVERSED")).status_code == 200
    payment = db.scalars(select(Payment)).one()
    assert payment.status == "REVERSED" and payment.paid_at is None
    assert db.scalars(select(Entitlement)).all() == []


def test_refund_letter_tells_what_happened(client, db, bank, monkeypatch):
    letters = []
    monkeypatch.setattr("app.mail.send",
                        lambda to, subject, text: letters.append((to, subject, text)) or True)
    body = paid_once(client, bank, "letter@example.ru")
    client.post("/api/payments/notify", json=refund_note(body))

    to, subject, text = letters[-1]
    assert to == "letter@example.ru" and "возвращ" in subject.lower()
    assert body["payment_id"] in text and "закрыт" in text
    assert "1992" not in text                     # дата рождения в письма не попадает


def test_sweep_skips_empty_runs(client, db, bank):
    """Нечего опрашивать — задача не создаётся: очередь не должна зарастать пустыми прогонами."""
    from app import sweep
    from app.models import PaymentSweep

    paid_once(client, bank, "settled@example.ru")
    assert sweep.run(db) is None
    assert db.scalars(select(PaymentSweep)).all() == []


def test_sweep_finishes_the_payment_nobody_confirmed(client, db, bank, monkeypatch):
    """Уведомление не дошло, браузер закрыт — доступ открывает досверка."""
    from app import sweep
    from app.models import PaymentSweep

    body = start(client, "lost@example.ru")
    payment = db.scalars(select(Payment)).one()
    assert payment.paid_at is None and db.scalars(select(Entitlement)).all() == []

    job = sweep.run(db)
    assert job is not None and job.status == "done"
    assert job.checked == 1 and job.changed == 1 and job.seconds() is not None

    entry = job.entries()[0]
    assert entry["payment"] == payment.id and entry["email"] == "lost@example.ru"
    assert entry["was"] == "NEW" and entry["now"] == "CONFIRMED" and entry["paid"] is True

    db.refresh(payment)
    assert payment.paid_at is not None
    assert db.scalars(select(Entitlement)).one().matrix_id == body["matrix_id"]


def test_sweep_writes_down_provider_errors(client, db, bank, monkeypatch):
    from app import sweep

    start(client, "broken-state@example.ru")

    def boom(_external_id):
        raise payments.PaymentError("GetState: банк недоступен")

    monkeypatch.setattr(payments.PROVIDERS["tbank"], "state", boom)
    job = sweep.run(db)
    assert job is not None and job.status == "done" and job.changed == 0
    assert "банк недоступен" in job.entries()[0]["error"]


def test_sweep_ignores_old_and_settled_payments(client, db, bank):
    import datetime as dt

    from app import sweep

    start(client, "old@example.ru")
    payment = db.scalars(select(Payment)).one()
    payment.created_at = payment.created_at - dt.timedelta(hours=30)
    db.commit()
    assert sweep.run(db) is None

    payment.created_at = payment.created_at + dt.timedelta(hours=30)
    payment.status = "REJECTED"
    db.commit()
    assert sweep.run(db) is None


def test_admin_sees_sweep_runs(client, auth, db, bank):
    from app.config import settings
    from app import sweep

    start(client, "queue-sweep@example.ru")
    sweep.run(db)
    admin = auth(settings.admins[0])
    body = client.get("/api/admin/sweeps", headers=admin).json()
    assert len(body["items"]) == 1
    run = body["items"][0]
    assert run["status"] == "done" and run["checked"] == 1 and run["log"][0]["email"] == "queue-sweep@example.ru"


# ── Чек (фискализация) ────────────────────────────────────────────────────────────────────────
# Боевой терминал с подключённой отправкой чеков в налоговую отклоняет Init без объекта Receipt
# (код 309 request.validate.expected.receipt), то есть без чека покупка не работает вообще.


def init_of(bank) -> dict:
    return next(payload for method, payload in bank if method == "Init")


def test_init_carries_the_receipt(client, db, bank):
    """В банк уходит чек: адрес покупателя, режим налогообложения и одна позиция покупки."""
    start(client, "check@example.ru")
    receipt = init_of(bank)["Receipt"]

    assert receipt["Email"] == "check@example.ru"
    assert receipt["Taxation"] == "patent"
    item, = receipt["Items"]
    # наименование читают двое: налоговая ищет вид деятельности, покупатель — что он купил
    assert item["Name"].startswith("Адаптация web-страницы"), item["Name"]
    assert "матрицы судьбы" in item["Name"], item["Name"]
    assert item["Quantity"] == 1
    assert (item["Price"], item["Amount"]) == (25_000, 25_000)
    assert item["Tax"] == "none"
    # «job» — «работа» по ФФД; «work» боевой терминал не признаёт и считает поле пустым
    assert item["PaymentObject"] == "job" and item["PaymentMethod"] == "full_payment"


def test_receipt_sum_always_matches_the_payment(client, db, bank):
    """Сумма позиций чека обязана совпасть с суммой платежа — иначе банк откажет в приёме."""
    from app.models import Tariff

    db.get(Tariff, "single").price = 99_900
    db.commit()
    start(client, "sum@example.ru")
    payload = init_of(bank)

    items = payload["Receipt"]["Items"]
    assert sum(i["Amount"] for i in items) == payload["Amount"] == 99_900


def test_receipt_name_fits_the_bank_limit(client, db, bank, monkeypatch):
    """Название позиции длиннее 128 символов банк не примет: режем, а не падаем."""
    from app.payments.tbank import NAME_LIMIT

    monkeypatch.setattr(payments.tbank.settings, "tbank_item_name", "Адаптация web-страницы " * 20)
    start(client, "long@example.ru")

    name = init_of(bank)["Receipt"]["Items"][0]["Name"]
    assert len(name) == NAME_LIMIT and name.startswith("Адаптация web-страницы")


def test_receipt_names_the_subject_of_the_contract_not_the_tariff(client, db, bank):
    """В чеке — предмет договора, а не витринное название. Патент выдан на разработку ПО, поэтому
    наименование позиции и описание платежа обязаны говорить о работах по адаптации страницы,
    как бы ни назывался тариф на витрине."""
    from app.models import Tariff

    db.get(Tariff, "single").name = "Полный разбор одной даты со скидкой"
    db.commit()
    start(client, "subject@example.ru")

    payload = init_of(bank)
    name = payload["Receipt"]["Items"][0]["Name"]
    assert "Адаптация web-страницы" in name and "матрицы судьбы" in name, name
    assert "скидк" not in name.lower(), "в чек попало витринное название тарифа"

    # Описание заказа человек читает на форме банка перед вводом карты. Отчётности в нём нет,
    # поэтому вида деятельности там быть не должно — только то, что покупатель узнаёт.
    shown = payload["Description"]
    assert "матриц" in shown.lower(), shown
    assert "адаптация" not in shown.lower() and "web-страниц" not in shown.lower(), \
        f"канцелярит на форме оплаты: {shown}"


def test_receipt_follows_the_tax_mode_from_settings(client, db, bank, monkeypatch):
    """Смена режима налогообложения — настройка на машине, а не правка кода."""
    monkeypatch.setattr(payments.tbank.settings, "tbank_taxation", "usn_income")
    monkeypatch.setattr(payments.tbank.settings, "tbank_vat", "vat20")
    monkeypatch.setattr(payments.tbank.settings, "tbank_payment_object", "intellectual_activity")
    monkeypatch.setattr(payments.tbank.settings, "tbank_payment_method", "full_prepayment")
    start(client, "usn@example.ru")

    receipt = init_of(bank)["Receipt"]
    assert receipt["Taxation"] == "usn_income"
    item, = receipt["Items"]
    assert item["Tax"] == "vat20" and item["PaymentObject"] == "intellectual_activity"
    assert item["PaymentMethod"] == "full_prepayment"


def test_payment_without_email_never_reaches_the_bank(bank):
    """Чек без адреса покупателя не примут, поэтому такой платёж не начинаем вовсе."""
    with pytest.raises(payments.PaymentError):
        payments.PROVIDERS["tbank"].start("arcana-1-x", 25_000, "Разбор", None)
    assert bank == [], "в банк ушёл запрос без чека"


def test_receipt_does_not_change_the_signature(client, db, bank):
    """Подпись считается по корневым полям: чек в неё не входит, иначе Token не сойдётся."""
    start(client, "sign@example.ru")
    payload = init_of(bank)

    without_receipt = {k: v for k, v in payload.items() if k != "Receipt"}
    assert BANK.token({**without_receipt, "TerminalKey": "1234DEMO"}) == \
        BANK.token({**payload, "TerminalKey": "1234DEMO"})


def test_sweep_stops_asking_about_an_abandoned_payment(client, db, bank, monkeypatch):
    """Человек ушёл с формы банка. Раньше досверка спрашивала про такой счёт сутки — каждые пять
    минут новая запись. Теперь после порога платёж закрывается как брошенный, и опрос прекращается,
    но право остаётся возможным: если оплата всё же случится, уведомление откроет доступ."""
    import datetime as dt

    from app import sweep
    from app.models import Payment

    monkeypatch.setattr(payments.PROVIDERS["tbank"], "state",
                        lambda pid: payments.Update(external_id=pid, order_id=None,
                                                    outcome=payments.Outcome.PENDING, status="NEW"))
    body = start(client, "left-the-form@example.ru")
    payment = db.scalars(select(Payment)).one()

    first = sweep.run(db)
    assert first is not None and payment.status == "NEW", "свежий счёт брошенным считать нельзя"

    payment.created_at = payment.created_at - dt.timedelta(hours=2)
    db.commit()
    second = sweep.run(db)
    assert second is not None and second.entries()[0].get("abandoned") is True
    db.refresh(payment)
    assert payment.status == sweep.ABANDONED

    assert sweep.run(db) is None, "досверка снова взялась за брошенный платёж"

    note = signed({"TerminalKey": "1234DEMO", "OrderId": body["order_id"], "Success": True,
                   "Status": "CONFIRMED", "PaymentId": body["payment_id"], "Amount": 25_000})
    assert client.post("/api/payments/notify", json=note).status_code == 200
    db.refresh(payment)
    assert payment.paid_at is not None, "опоздавшая оплата обязана открыть доступ"
    assert db.scalars(select(Entitlement)).one().active() is True


def test_declined_card_does_not_block_a_second_attempt(client, db, bank, monkeypatch):
    """Карту отклонили — человек обязан иметь возможность заплатить другой. Раньше он попадал на
    страницу уже отклонённого платежа и вылетал на «Платёж не прошёл», не увидев формы: статус у
    нас оставался NEW (на отказ уведомление не приходит), а старая ссылка предлагалась ещё полчаса."""
    from app.models import Payment

    first = start(client, "declined@example.ru", "1994-04-04")
    monkeypatch.setattr(payments.PROVIDERS["tbank"], "state",
                        lambda pid: payments.Update(external_id=pid, order_id=None,
                                                    outcome=payments.Outcome.FAILED,
                                                    status="REJECTED"))
    again = client.post("/api/payments/start",
                        json={"tariff": "single", "email": "declined@example.ru",
                              "birth": "1994-04-04"}).json()

    assert again.get("order_id") != first["order_id"], "предложен счёт отклонённого платежа"
    assert again.get("payment_url"), f"новый счёт не выставлен — платить нечем: {again}"
    rejected = db.get(Payment, int(first["order_id"].split("-")[1]))
    assert rejected.status == "REJECTED", "отказ банка не записан"


def test_second_refund_returns_state_instead_of_an_error(client, auth, db, bank, monkeypatch):
    """Повторный возврат отдаёт текущее состояние: устаревшая вкладка получала отказ банка и
    оставляла строку «оплачен» с живой кнопкой — интерфейс уверял, что деньги на месте."""
    from app.config import settings
    from app.models import Payment

    body = paid_once(client, bank, "twice-refund@example.ru", "1995-05-05")
    monkeypatch.setattr(payments.PROVIDERS["tbank"], "cancel",
                        lambda pid: payments.Update(external_id=pid, order_id=None,
                                                    outcome=payments.Outcome.REFUNDED,
                                                    status="REFUNDED"))
    admin = auth(settings.admins[0])
    payment = db.scalars(select(Payment)).one()

    first = client.post(f"/api/admin/payments/{payment.id}/refund", headers=admin)
    assert first.status_code == 200 and first.json()["refunded_at"]

    def refuse(_pid):
        raise payments.PaymentError("Cancel: платёж уже возвращён (код 9999)")

    monkeypatch.setattr(payments.PROVIDERS["tbank"], "cancel", refuse)
    second = client.post(f"/api/admin/payments/{payment.id}/refund", headers=admin)
    assert second.status_code == 200, second.text
    assert second.json()["already"] is True and second.json()["refunded_at"]


def test_payment_state_is_decided_on_the_server(client, db, bank, monkeypatch):
    """Состояние платежа считает сервер: экраны собирали его сами из трёх отметок, и порядок
    проверок решал исход — возвращённый платёж выглядел оплаченным."""
    from app.models import Payment

    body = paid_once(client, bank, "state@example.ru", "1996-06-06")
    payment = db.scalars(select(Payment)).one()
    assert payment.state() == "paid"

    client.post("/api/payments/notify", json=refund_note(body))
    db.refresh(payment)
    assert payment.state() == "refunded", "после возврата платёж всё ещё выглядит оплаченным"
    assert payment.paid_at is not None, "отметка об оплате — факт истории, её не стираем"

    headers = {"Authorization": f"Bearer {body['token']}"}
    answer = client.post("/api/payments/sync", json={"order_id": body["order_id"]},
                         headers=headers).json()
    assert answer["state"] == "refunded" and answer["paid"] is True
