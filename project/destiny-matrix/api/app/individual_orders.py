"""Paid orders of individual readings (docs/individual-reading.md).

The browser sends what is in the order; the price is counted here from the `prices` table. A paid
order turns into individual reading requests — the same rows the admin form creates — plus the
automatic readings of the same dates: they are part of the order (automatic + individual), so they
open as bought, not as granted.
"""
from __future__ import annotations

import datetime as dt
import json
from collections import Counter
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import access, notifications, offers, payments, prices, products, readings
from .db import begin_write
from .http_errors import error
from .models import IndividualReading, Purchase, User, utcnow

OFFER_ID = "individual"
TYPICAL_DAYS = 1
MAX_DAYS = 3


def default_year(today: dt.date | None = None) -> int:
    """In the first half of the year — this year, from July on — the next one."""
    today = today or dt.date.today()
    return today.year if today.month <= 6 else today.year + 1


ROLES = {"individual_1": "first", "individual_2": "second", "individual_3": "third",
         "individual_next": "next", "individual_after_three": "after_three"}
KINDS = ("personal", "pair", "year")
MAX_PER_KIND = 10


def price_list(db: Session) -> dict[str, int]:
    """Rubles by role: first, second, third, next, after_three."""
    raw = prices.of_type(db, prices.INDIVIDUAL)
    return {role: raw[key] // 100 for key, role in ROLES.items()}


def ladder(n: int, p: dict[str, int]) -> int:
    """Price of n readings in one order: first, second, third, then `next` for each one more."""
    if n <= 0:
        return 0
    if n == 1:
        return p["first"]
    if n == 2:
        return p["second"]
    return p["third"] + (n - 3) * p["next"]


def price(cart: dict[str, int], bought: int, p: dict[str, int]) -> int:
    """Rubles. With three paid readings, any reading costs `after_three`."""
    n = sum(cart.values())
    return n * p["after_three"] if bought >= 3 else ladder(n, p)


def bought(db: Session, user_id: int | None) -> int:
    """Individual readings the person paid for; those the admin wrote for free do not count."""
    if user_id is None:
        return 0
    return db.scalar(select(func.count()).select_from(IndividualReading)
                     .where(IndividualReading.user_id == user_id, IndividualReading.purchase_id.is_not(None))) or 0


def terms(db: Session, user: User | None) -> dict:
    # payable: this site has a way to take the money; .com has none until the foreign acquiring
    return {"bought": bought(db, user.id if user else None), "default_year": default_year(),
            "prices": price_list(db), "typical_days": TYPICAL_DAYS, "max_days": MAX_DAYS,
            "payable": bool(payments.available())}


class Person(BaseModel):
    birth: dt.date
    sex: Literal["f", "m"] = "f"


class ReadingIn(BaseModel):
    kind: Literal["personal", "pair", "year"]
    # indexes in `persons`: one person, two for a couple
    who: list[int] = Field(min_length=1, max_length=2)
    year: int | None = Field(default=None, ge=1900, le=2200)
    relation: str = Field(default="", max_length=200)


class OrderIn(BaseModel):
    provider: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_-]{0,31}$")
    email: EmailStr
    persons: list[Person] = Field(default_factory=list, max_length=2 * MAX_PER_KIND * len(KINDS))
    readings: list[ReadingIn] = Field(default_factory=list, max_length=MAX_PER_KIND * len(KINDS))
    question: str = Field(default="", max_length=5000)
    # automatic readings of the order's dates, built by the site: `personal_<i>`, `pair_<i>_<j>`
    snapshots: dict = Field(default_factory=dict)

    @field_validator("email")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return v.strip().lower()


def _refuse(ru: str, en: str):
    raise error(422, ru, en)


def snapshot_key(kind: str, who: list[int]) -> str:
    return f"pair_{who[0]}_{who[1]}" if kind == "pair" else f"personal_{who[0]}"


def order_of(payload: OrderIn) -> dict:
    """What the paid order will create, checked before the money is taken: every reading has its
    own people, nothing is left to sort out after the payment."""
    if not payload.readings:
        _refuse("Добавьте хотя бы один разбор.", "Add at least one reading.")
    cart = {k: sum(r.kind == k for r in payload.readings) for k in KINDS}
    if max(cart.values()) > MAX_PER_KIND:
        _refuse("Слишком много разборов в одном заказе.", "Too many readings in one order.")
    persons = [{"birth": p.birth.isoformat(), "sex": p.sex} for p in payload.persons]
    for p in persons:
        try:
            products.PRODUCTS[products.PERSONAL].normalize(p)
        except ValueError:
            _refuse("Проверьте даты рождения.", "Check the birth dates.")
    rows = []
    for r in payload.readings:
        n = 2 if r.kind == "pair" else 1
        if len(r.who) != n or len(set(r.who)) != n or not all(0 <= i < len(persons) for i in r.who):
            _refuse("Проверьте, для кого каждый разбор.", "Check who each reading is for.")
        rows.append({"kind": r.kind, "who": list(r.who),
                     "year": (r.year or default_year()) if r.kind == "year" else None,
                     "relation": r.relation.strip() if r.kind == "pair" else ""})
    if {i for r in rows for i in r["who"]} != set(range(len(persons))):
        _refuse("Проверьте, для кого каждый разбор.", "Check who each reading is for.")
    same = {(r["kind"], tuple(sorted(r["who"])), r["year"]) for r in rows}
    if len(same) < len(rows):
        _refuse("В заказе два одинаковых разбора.", "The order has the same reading twice.")
    need = {snapshot_key(r["kind"], r["who"]) for r in rows}
    missing = need - {k for k, v in payload.snapshots.items() if isinstance(v, dict)}
    if missing:
        _refuse("Не удалось подготовить расчёт по датам.", "Could not prepare the reading for these dates.")
    return {"cart": cart, "persons": persons, "readings": rows, "question": payload.question.strip(),
            "snapshots": {k: payload.snapshots[k] for k in sorted(need)}}


def fingerprint(order: dict) -> str:
    """The same order a second time: two tabs or a second click must not become two orders."""
    return json.dumps({k: order[k] for k in ("cart", "persons", "readings", "question")},
                      sort_keys=True, ensure_ascii=False)


def title(cart: dict, locale: str) -> str:
    """Name of the order on the bank page and in the receipt."""
    n = sum(cart.values())
    if locale == "en":
        return "Individual reading" if n == 1 else f"Individual readings × {n}"
    return "Индивидуальный разбор" if n == 1 else f"Индивидуальные разборы × {n}"


def _parts(order: dict, en: bool) -> str:
    def name(kind: str, year: int | None) -> str:
        if kind == "year":
            return f"year {year}" if en else f"год {year}"
        return {"personal": "personal", "pair": "couple"}[kind] if en else {"personal": "личный", "pair": "пара"}[kind]
    counts = Counter((r["kind"], r["year"]) for r in order["readings"])
    keys = sorted(counts, key=lambda k: (KINDS.index(k[0]), k[1] or 0))
    return ", ".join(f"{name(*k)} × {counts[k]}" for k in keys)


def _plan(order: dict) -> list[dict]:
    """One request per reading, each with its own people and the automatic reading of their dates."""
    persons, snaps = order["persons"], order["snapshots"]
    summary = f"Заказ: {_parts(order, False)}." + (f"\nВопрос: {order['question']}" if order["question"] else "")
    rows: list[dict] = []
    for r in order["readings"]:
        who = r["who"]
        if r["kind"] == "pair":
            a, b = (persons[i] for i in who)
            product, inputs = "pair", {"a": {"birth": a["birth"]}, "b": {"birth": b["birth"]}}
        else:
            product, inputs = "personal", persons[who[0]]
        relation = f"\nКто друг другу: {r['relation']}." if r["relation"] else ""
        rows.append({"product": product, "kind": product, "year": r["year"], "inputs": inputs,
                     "snapshot": snaps[snapshot_key(r["kind"], who)], "comment": summary + relation})
    return rows


def _workdays(start: dt.date, days: int) -> dt.date:
    d, left = start, days
    while left > 0:
        d += dt.timedelta(days=1)
        if d.weekday() < 5:
            left -= 1
    return d


def _open_automatic(db: Session, purchase: Purchase, product: str, raw: dict) -> list[int]:
    """The automatic reading of the order's dates opens as bought: a part of the paid order, under
    its own zero-priced line so that every reading keeps one right per order."""
    user = db.get(User, purchase.user_id)
    spec = products.PRODUCTS[product]
    row = readings.create(db, user, spec, raw, limited=False)
    row.saved_via = row.saved_via or "purchase"
    row.removed_at = None
    body = {"products": [product], "per_reading": True}
    if access.covering(access.active_rights(db, user), body, row, forever=True):
        return []
    offer = offers.get(db, offers.PAIR_ID if product == products.PAIR else offers.SINGLE_ID)
    main = purchase.body()
    line = Purchase(user_id=user.id, offer_id=offer.id, reading_id=row.id, amount=0, currency=offer.currency,
                    channel=offer.channel, paid_at=purchase.paid_at or utcnow(),
                    offer_body=json.dumps({**offer.body(), "display_name": offer.public_body()["name"],
                                           "part_of": purchase.id, "locale": main.get("locale", "ru"),
                                           "site_origin": main.get("site_origin"),
                                           "connection_id": main.get("connection_id")}, ensure_ascii=False))
    db.add(line)
    db.flush()
    right = access.grant(db, user, line.body(), purchase=line, reading_id=row.id, now=line.paid_at)
    return notifications.grant_event(db, user, right, row, paid=False,
                                     extra={"source": "purchase", "offer_name": main.get("display_name", "")})


def fulfil(db: Session, purchase_id: int) -> int:
    """Create the paid order's requests once: the bank repeats its notifications."""
    begin_write(db)
    purchase = db.get(Purchase, purchase_id)
    body = purchase.body() if purchase else {}
    if purchase is None or body.get("kind") != OFFER_ID or purchase.paid_at is None:
        db.commit()
        return 0
    done = db.scalar(select(func.count()).select_from(IndividualReading)
                     .where(IndividualReading.purchase_id == purchase.id)) or 0
    if done:
        db.commit()
        return 0
    order = body["order"]
    rows = _plan(order)
    locale = body.get("locale", "ru")
    for r in rows:
        inputs = products.PRODUCTS[r["product"]].normalize(r["inputs"])
        db.add(IndividualReading(user_id=purchase.user_id, product=r["product"], kind=r["kind"], year=r["year"],
                                 inputs=json.dumps(inputs), locale=locale, comment=r["comment"],
                                 automatic_reading=json.dumps(r["snapshot"], ensure_ascii=False),
                                 purchase_id=purchase.id))
    # the automatic readings are announced in the account; the email is one — "order accepted"
    automatic = {(r["product"], json.dumps(products.PRODUCTS[r["product"]].normalize(r["inputs"]), sort_keys=True))
                 for r in rows}
    for product, raw in sorted(automatic):
        _open_automatic(db, purchase, product, json.loads(raw))
    today = dt.date.today()
    ids = notifications.emit(db, "individual_order_accepted", f"individual-order:{purchase.id}",
        {"locale": locale, "site_origin": body.get("site_origin"),
         "parts": {"ru": _parts(order, False), "en": _parts(order, True)},
         "typical": _workdays(today, TYPICAL_DAYS).isoformat(), "latest": _workdays(today, MAX_DAYS).isoformat()},
        [purchase.user_id])
    db.commit()
    notifications.deliver_emails(db, ids)
    return len(rows)
