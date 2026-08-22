"""Длинная цепочка на живом эквайринге: две удачные оплаты, отказ, затем ещё одна удачная.

Запускается отдельно: стенд должен работать на провайдере tbank (ключи тестового терминала).
    PAYMENT_PROVIDER=tbank MAIL_TO_LOG=1 ./scripts/run.sh
    pytest -m bank
"""
from __future__ import annotations

import pytest
from playwright.sync_api import expect

import flows
from conftest import BASE

pytestmark = pytest.mark.bank


def test_four_purchases_in_a_row_open_exactly_what_was_chosen(page, mail):
    dates = [(2, 3, 1993), (20, 3, 1993), (31, 3, 1993), (11, 8, 2004)]
    cards = [flows.GOOD_CARD, flows.GOOD_CARD, flows.BAD_CARD, flows.GOOD_CARD]
    outcomes = []

    for (day, month, year), card in zip(dates, cards):
        flows.calculate(page, day, month, year)
        flows.open_pay(page)
        assert flows.label(day, month, year) in page.get_by_test_id("pay-submit").inner_text()
        flows.pay_on_bank_form_start(page, mail)
        flows.pay_on_bank_form(page, card)
        outcomes.append(page.url)
        if "/pay/done" in page.url:
            expect(page.locator(".paybox h3")).to_contain_text("Доступ открыт", timeout=60_000)
            page.get_by_role("link", name="Открыть полный разбор").click()
            page.wait_for_timeout(1500)
            assert flows.locked_sections(page) == 0

    assert outcomes[2].endswith("fail") or "/pay/fail" in outcomes[2], outcomes

    flows.account(page)
    cards_text = {}
    items = flows.matrix_cards(page)
    for i in range(items.count()):
        text = items.nth(i).inner_text()
        head = text.split("\n")[0]
        cards_text[head] = "куплена" in text.lower()

    for day, month, year in (dates[0], dates[1], dates[3]):
        key = f"Матрица {flows.label(day, month, year)}"
        assert cards_text.get(key) is True, (key, cards_text)
    отказ = f"Матрица {flows.label(*dates[2])}"
    assert cards_text.get(отказ) is False, (отказ, cards_text)


def test_notification_opens_access_without_the_browser(page, mail, api_notify):
    """Доступ открывает уведомление провайдера, а не страница возврата: браузер тут не участвует.

    На стенде уведомление посылает себе сам сервис — банк до 127.0.0.1 не дотянется, — но подпись
    и обработка те же, что в проде.
    """
    flows.register(page, mail)
    flows.calculate(page, 24, 4, 1991)
    flows.open_pay(page)
    matrix_id = None
    with page.expect_navigation(url=lambda u: "pay.tbank.ru" in u or "securepay" in u,
                               timeout=60_000):
        flows.pay_on_bank_form_start(page, mail)

    payment_id = page.request.get(f"{BASE}/api/payments").json()["items"][0]["external_id"]
    matrix_id = page.request.get(f"{BASE}/api/payments").json()["items"][0]["matrix_id"]
    assert page.request.get(f"{BASE}/api/matrices/{matrix_id}").json()["unlocked"] is False

    api_notify(payment_id, "CONFIRMED")

    assert page.request.get(f"{BASE}/api/matrices/{matrix_id}").json()["unlocked"] is True
    flows.account(page)
    assert "куплена" in flows.matrix_cards(page).first.inner_text().lower()
