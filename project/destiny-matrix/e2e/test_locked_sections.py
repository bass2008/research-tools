"""Закрытые разделы: видно, что внутри, а платный текст до оплаты в браузер не уходит."""
from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

import pytest
from playwright.sync_api import expect

import flows
from conftest import BASE, REMOTE

pytestmark = pytest.mark.skipif(REMOTE, reason="Requires local mock payments")

BIRTH = "1990-06-15"
SLUG = "15-6-19"
SHOWN = {"lead", "chakraNote", "topic", "title", "label", "href", "slug", "testId"}
CORPUS = json.loads((Path(__file__).parents[1] / "web/content/ru/chakra-personal.json").read_text())


def pieces(text: str) -> list[str]:
    # HTML и RSC экранируют кавычки по-своему: ищем куски между ними.
    return [part.strip() for part in re.split(r"[\"'«»“”’<>&\\*]", text) if len(part.strip()) >= 30]


def texts_of(sections: list[dict], access: str, shown: bool = False) -> set[str]:
    out: set[str] = set()

    def walk(value, key=""):
        if isinstance(value, str):
            if (key in SHOWN) == shown:
                out.update(pieces(value))
        elif isinstance(value, list):
            for item in value:
                walk(item, key)
        elif isinstance(value, dict):
            for k, v in value.items():
                walk(v, k)

    for section in sections:
        if section["access"] != access:
            continue
        walk(section["lead"], "lead")
        for position in section["positions"]:
            walk(position.get("text", ""), "text")
        walk(section.get("longform"))
        walk(section.get("tailReading"))
    return out


def secret_of(sections: list[dict], public: str) -> set[str]:
    """Платный текст собран и из общих кубиков: краткая суть аркана, связки ролей, вводка раздела.
    Они видны и без даты, поэтому секрет — только то, чего нет ни в бесплатном, ни на странице."""
    common = texts_of(sections, "free") | texts_of(sections, "paid", shown=True)
    return {p for p in texts_of(sections, "paid") - common if p not in public}


def chakra_pieces() -> set[str]:
    rows = [r for c in CORPUS["chakras"].values() for r in c["readings"].values()]
    rows += list(CORPUS["energy_field"]["readings"].values())
    return {piece for r in rows for text in [r["heading"], *r["paragraphs"]] for piece in pieces(text)[:1]}


def words(paragraphs: list[str]) -> int:
    return sum(1 for w in " ".join(paragraphs).split() if any(ch.isalnum() for ch in w))


def leaks(body: str, phrases: set[str]) -> list[str]:
    return [p for p in phrases if p in body]


def buy(page, mail: str) -> int:
    assert page.request.post(BASE + "/api/auth/register", data={"email": mail, "password": "1234"}).ok
    bought = page.request.post(BASE + "/api/payments/start", data={
        "tariff": "single", "email": mail, "birth": BIRTH, "sex": "f", "provider": "mock"}).json()
    assert bought["paid"]
    return bought["matrix_id"]


def test_locked_sections_show_cards_but_not_paid_text(page, browser, mail):
    paid_id = buy(page, mail)
    guest = browser.new_context(viewport={"width": 390, "height": 900}, locale="ru-RU").new_page()
    guest.goto(BASE + "/", wait_until="networkidle")
    public = guest.content() + guest.request.get(BASE + "/", headers={"RSC": "1"}).text()

    paid = {lang: page.request.get(f"{BASE}/api/sections?m={paid_id}", headers={"Accept-Language": lang}).json()["sections"]
            for lang in ("ru", "en")}
    secret = {lang: secret_of(rows, public) for lang, rows in paid.items()}
    assert min(len(rows) for rows in secret.values()) > 100

    # Сторож не слепой: в оплаченном разборе те же куски находятся.
    page.goto(f"{BASE}/report?m={paid_id}", wait_until="networkidle")
    assert len(leaks(page.content(), secret["ru"])) > len(secret["ru"]) // 2
    assert flows.locked_sections(page) == 0
    expect(page.get_by_test_id("chakras-reading")).to_have_count(1)
    expect(page.locator("[data-testid^=chakra-lock-]")).to_have_count(0)
    expect(page.locator("[data-testid^=section-buy-]")).to_have_count(0)

    bodies: list[str] = []

    def keep(response):
        if response.request.resource_type in ("document", "fetch", "xhr") and response.ok:
            try:
                bodies.append(response.text())
            except Exception:
                pass

    guest.on("response", keep)
    flows.calculate(guest, 15, 6, 1990, "f")
    expect(guest.locator("[data-locked=true] .mp")).to_have_count(17)
    expect(guest.locator("[data-testid^=section-buy-]")).to_have_count(18)
    for link in guest.locator("[data-testid^=section-buy-]").all():
        assert link.get_attribute("href") == "/pay?for=personal"

    chakras = next(s for s in paid["ru"] if s["key"] == "chakras")["longform"]
    expect(guest.locator("[data-testid^=chakra-lock-]")).to_have_count(8)
    for row in [*chakras["chakraRows"], chakras["energyField"]]:
        plate = guest.get_by_test_id(f"chakra-lock-{row['key']}").inner_text()
        assert re.search(rf"\b{words(row['paragraphs'])}\b", plate), (row["key"], plate)

    guest.goto(BASE + "/report", wait_until="networkidle")
    expect(guest.locator("[data-locked=true] .mp")).to_have_count(17)
    for path in ("/", "/report"):
        bodies.append(guest.request.get(BASE + path, headers={"RSC": "1"}).text())

    every = "\n".join(bodies)
    assert leaks(every, secret["ru"]) == []
    assert leaks(every, chakra_pieces()) == []
    english = guest.request.get(f"{BASE}/api/sections?slug={SLUG}&preview=locked", headers={"Accept-Language": "en"})
    assert english.ok and leaks(english.text(), secret["en"]) == []
    guest.context.close()


def test_saved_locked_matrix_shows_the_same_preview(page, browser, mail):
    buyer = browser.new_context().new_page()
    paid_id = buy(buyer, mail)
    paid = buyer.request.get(f"{BASE}/api/sections?m={paid_id}").json()["sections"]
    buyer.context.close()

    page.goto(BASE + "/", wait_until="networkidle")
    secret = secret_of(paid, page.content() + page.request.get(BASE + "/", headers={"RSC": "1"}).text())
    assert len(secret) > 100

    other = f"e2e-{uuid.uuid4().hex[:10]}@example.ru"
    assert page.request.post(BASE + "/api/auth/register", data={"email": other, "password": "1234"}).ok
    saved = page.request.post(BASE + "/api/matrices", data={"birth": BIRTH, "sex": "f"}).json()
    response = page.goto(f"{BASE}/matrices/{saved['id']}", wait_until="networkidle")
    html = response.text()
    rsc = page.request.get(f"{BASE}/matrices/{saved['id']}", headers={"RSC": "1"}).text()
    expect(page.locator("[data-locked=true]")).to_have_count(18)
    expect(page.locator("[data-locked=true] .mp")).to_have_count(17)
    expect(page.locator("[data-testid^=chakra-lock-]")).to_have_count(8)
    assert page.get_by_test_id("section-buy-profession").get_attribute("href") == f"/pay?for=personal&m={saved['id']}"
    assert leaks(html + rsc, secret) == []
    assert leaks(html + rsc, chakra_pieces()) == []
