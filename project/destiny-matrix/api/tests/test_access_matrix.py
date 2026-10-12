"""Все сочетания доступа к одному разбору: продукт × откуда открыт × порядок возвратов.

Аудиты шесть раз подряд находили непокрытую клетку этой таблицы на каком-нибудь экране. Здесь
таблица перебирается целиком, а ожидания записаны по правилам из docs/schema.md, а не сняты с
кода: купленное навсегда главнее выданного, выданное — подписки, купленная подписка — выданной;
возврат снимает только права своего заказа; выданное помечено выданным.
"""
from __future__ import annotations

import itertools

import pytest
from sqlalchemy import select

from app.config import settings
from app.models import Payment, User

PAIR = {"a": {"birth": "1993-03-31"}, "b": {"birth": "1994-12-28"}}
PERSONAL = {"birth": "1977-04-03", "sex": "f"}
INPUTS = {"personal": PERSONAL, "pair": PAIR}
SINGLE = {"personal": "single", "pair": "pair"}
OFFER_NAME = {"personal": "Полный разбор одной даты", "pair": "Совместимость пары"}
WHAT = {"personal": "даты", "pair": "пары"}
SOURCES = ("bought", "sub_bought", "granted", "sub_granted")
PAID = ("bought", "sub_bought")


def expected(product: str, left: set[str]) -> dict:
    if "bought" in left:
        return {"access": "forever", "access_granted": False, "plan": f"тариф «{OFFER_NAME[product]}»"}
    if "granted" in left:
        return {"access": "granted", "access_granted": True, "plan": "выдан бесплатно"}
    if "sub_bought" in left:
        return {"access": "subscription", "access_granted": False, "plan": "тариф «Подписка на 3 месяца»"}
    if "sub_granted" in left:
        return {"access": "subscription", "access_granted": True, "plan": "выдан бесплатно"}
    return {"access": "locked", "access_granted": False, "plan": "Бесплатный просмотр"}


def expected_holdings(product: str, left: set[str]) -> list[tuple]:
    rows = [("subscription", source) for key, source in (("sub_bought", "bought"), ("sub_granted", "granted"))
            if key in left]
    if "bought" in left:
        rows.append(("reading", "bought", product))
    elif "granted" in left:
        rows.append(("reading", "granted", product))
    return rows


def expected_outcome(product: str, refunded: str, left: set[str]) -> str:
    if refunded == "bought":
        state = expected(product, left)["access"]
        if state == "locked":
            return f"Разбор этой {WHAT[product]} закроется."
        if state == "subscription":
            return f"Разбор этой {WHAT[product]} останется открытым по подписке до "
        return f"Разбор этой {WHAT[product]} останется открытым: он выдан бесплатно."
    if "sub_granted" in left:
        return "Подписка по этому платежу закончится, но доступ останется по другой подписке до "
    return "Подписка закончится. Разборы, купленные отдельно или выданные, останутся открытыми."


def cases():
    for product in ("personal", "pair"):
        for n in range(1, len(SOURCES) + 1):
            for chosen in itertools.combinations(SOURCES, n):
                paid = [s for s in PAID if s in chosen]
                for order in itertools.permutations(paid) if paid else [()]:
                    yield pytest.param(product, set(chosen), order,
                                       id=f"{product}-{'+'.join(chosen)}-refund:{'>'.join(order) or 'none'}")


@pytest.mark.parametrize(("product", "sources", "refunds"), list(cases()))
def test_every_combination_reads_the_same_everywhere(client, auth, db, product, sources, refunds):
    email = "matrix@example.ru"
    user = auth(email)
    admin = auth(settings.admins[0])
    user_id = db.scalar(select(User).where(User.email == email)).id
    reading = client.post("/api/readings", json={"product": product, "inputs": INPUTS[product]}, headers=user).json()

    # Сначала покупки: открытое заранее сайт не продаёт, а выдача поверх покупки разрешена.
    if "bought" in sources:
        answer = client.post("/api/payments/mock", json={"tariff": SINGLE[product], "email": email,
                                                        "reading_id": reading["id"]})
        assert answer.status_code == 200, answer.text
    if "sub_bought" in sources:
        answer = client.post("/api/payments/mock", json={"tariff": "month", "email": email})
        assert answer.status_code == 200, answer.text
    if "granted" in sources:
        assert client.post(f"/api/admin/users/{user_id}/readings", headers=admin,
                           json={"product": product, "inputs": INPUTS[product]}).status_code == 200
    if "sub_granted" in sources:
        assert client.post(f"/api/admin/users/{user_id}/subscription", headers=admin).status_code == 200

    payments = {p.purchase.offer_id: p.id for p in db.scalars(select(Payment).where(Payment.user_id == user_id))}

    def check(left: set[str]) -> None:
        card = client.get(f"/api/readings/{reading['id']}", headers=user).json()
        want = expected(product, left)
        assert {k: card[k] for k in want} == want, f"осталось {sorted(left)}"
        assert card["unlocked"] is (want["access"] != "locked")
        holdings = client.get("/api/auth/me", headers=user).json()["access"]["holdings"]
        got = [(h["kind"], h["source"]) + ((h["product"],) if h["kind"] == "reading" else ()) for h in holdings]
        assert got == expected_holdings(product, left), f"осталось {sorted(left)}"
        admin_row = client.get(f"/api/admin/users/{user_id}", headers=admin).json()["user"]
        assert admin_row["holdings"] == holdings, "админка и кабинет читают одну сводку"

    left = set(sources)
    check(left)
    for source in refunds:
        payment_id = payments[SINGLE[product] if source == "bought" else "month"]
        outcome = client.get(f"/api/admin/payments/{payment_id}/refund-preview", headers=admin).json()["outcome"]
        left.discard(source)
        assert outcome.startswith(expected_outcome(product, source, left)), outcome
        assert client.post(f"/api/admin/payments/{payment_id}/refund", headers=admin).status_code == 200
        check(left)
