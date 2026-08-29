"""Цикл 11, ступень 1: поведение при сбоях. Раунд 6."""
from __future__ import annotations

import re
import uuid

import pytest
from playwright.sync_api import Page

import flows
from conftest import BASE

pytestmark = pytest.mark.bug


def test_lost_response_does_not_claim_the_money_is_safe(page: Page):
    """Ответ на оплату терялся, платёж проходил, а форма писала «деньги не списаны»."""
    mail = f"agent-lost-{uuid.uuid4().hex[:8]}@example.com"
    flows.calculate(page, 14, 6, 1990)
    page.goto(f"{BASE}/pay", wait_until="domcontentloaded")
    page.wait_for_selector("[data-testid=pay-submit]")

    def cut(route):
        route.abort("connectionfailed")

    page.route("**/api/payments/**", cut)
    page.get_by_test_id("pay-email").fill(mail)
    if page.get_by_test_id("pay-password").count():
        page.get_by_test_id("pay-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    page.wait_for_selector(".err", timeout=30_000)
    text = page.locator(".err").first.inner_text()
    assert "не списаны" not in text, f"обещание про деньги при потерянном ответе: «{text}»"


def test_failed_logout_says_so(page: Page):
    """Обрыв запроса выхода уводил на главную, хотя кука жива и человек остался в аккаунте."""
    mail = f"agent-out-{uuid.uuid4().hex[:8]}@example.com"
    flows.register(page, mail)
    page.route("**/api/auth/logout", lambda route: route.abort())
    page.get_by_test_id("logout").click()
    page.wait_for_timeout(2500)
    assert page.get_by_test_id("logout-error").count(), "о неудачном выходе не сказано"
    assert "/account" in page.url, f"ушли на {page.url}, хотя выход не состоялся"


def test_receipt_survives_a_dead_api(page: Page):
    """F5 на чеке при неотвечающем API подменял его формой «Оплатить» за уже оплаченное."""
    mail = f"agent-rec-{uuid.uuid4().hex[:8]}@example.com"
    flows.buy(page, mail, 7, 7, 1977)
    page.wait_for_timeout(800)
    paid = page.url
    assert "paid=" in paid

    page.route("**/api/payments", lambda route: route.abort())
    page.goto(paid, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    text = page.inner_text("main")
    assert "Оплатить" not in text, "при неотвечающем API чек подменён формой оплаты"


def test_account_shows_one_state_when_the_list_fails(page: Page):
    """Кабинет показывал сразу три состояния: «Загружаем список…», ошибку и предложение сохранить."""
    mail = f"agent-acc-{uuid.uuid4().hex[:8]}@example.com"
    flows.register(page, mail)
    flows.calculate(page, 3, 3, 1993)
    page.route("**/api/matrices", lambda route: route.abort())
    page.goto(f"{BASE}/account", wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    text = page.inner_text("main")
    assert "Загружаем список" not in text, "вечная загрузка рядом с ошибкой"
    assert page.get_by_test_id("save-matrix").count() == 0, (
        "предложение сохранить показано, хотя список не загружен"
    )


def test_refunded_receipt_does_not_promise_access(page: Page):
    """Чек после возврата продолжал писать «Доступ открыт»."""
    mail = f"agent-ref-{uuid.uuid4().hex[:8]}@example.com"
    flows.buy(page, mail, 21, 7, 1983)
    page.wait_for_timeout(800)
    receipt = page.url

    flows.logout(page)
    from conftest import ADMIN

    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    row = page.locator("[data-testid=admin-payment-row]", has_text=mail).first
    row.wait_for(timeout=20_000)
    page.once("dialog", lambda d: d.accept())
    row.get_by_test_id("refund").click()
    page.wait_for_timeout(2500)

    flows.logout(page)
    flows.login(page, mail)
    page.goto(receipt, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    assert "Доступ открыт" not in page.inner_text("main"), "чек обещает доступ после возврата"
