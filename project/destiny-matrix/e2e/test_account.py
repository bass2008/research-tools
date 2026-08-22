"""Кабинет: хранение, подписи, платежи, вход."""
from __future__ import annotations

from playwright.sync_api import expect

import flows
from conftest import BASE


def test_purchase_adds_a_storage_slot(page, mail):
    """Бесплатная дата одна; каждая покупка добавляет слот — это видно в кабинете."""
    flows.register(page, mail)
    flows.account(page)
    slots = page.locator("dd", has_text="слот даёт")
    assert "из 1" in slots.inner_text(), slots.inner_text()

    flows.buy(page, mail, 3, 4, 1991)
    flows.account(page)
    assert "из 2" in page.locator("dd", has_text="слот даёт").inner_text()


def test_paid_matrix_is_marked_and_can_be_renamed(page, mail):
    flows.buy(page, mail, 5, 5, 1995)
    flows.account(page)
    card = flows.matrix_cards(page).first
    assert "куплена" in card.inner_text().lower()

    card.get_by_test_id("rename-matrix").click()
    field = page.get_by_test_id("rename-input")
    field.fill("Моя матрица")
    page.get_by_test_id("rename-save").click()
    page.wait_for_timeout(900)
    page.reload()
    page.wait_for_timeout(800)
    assert "Моя матрица" in flows.matrix_cards(page).first.inner_text()


def test_payment_appears_in_history(page, mail):
    flows.buy(page, mail, 6, 6, 1996)
    flows.account(page)
    expect(page.get_by_test_id("payments-panel")).to_contain_text("250")


def test_access_survives_logout_and_login(page, mail):
    flows.buy(page, mail, 7, 7, 1997)
    page.get_by_test_id("logout").click()
    page.wait_for_timeout(700)
    flows.login(page, mail)
    flows.account(page)
    assert "куплена" in flows.matrix_cards(page).first.inner_text().lower()


def test_password_reset_lets_you_in(page, mail, api_log):
    flows.register(page, mail, "1234")
    page.get_by_test_id("logout").click()
    page.wait_for_timeout(600)

    page.goto(f"{BASE}/forgot", wait_until="domcontentloaded")
    page.get_by_test_id("forgot-email").fill(mail)
    page.get_by_test_id("forgot-submit").click()
    expect(page.get_by_test_id("forgot-sent")).to_be_visible()

    token = flows.token_from(api_log("/reset?token="))
    assert token, "ссылки на сброс нет в логе api"

    page.goto(f"{BASE}/reset?token={token}", wait_until="domcontentloaded")
    page.get_by_test_id("reset-password").fill("newpass")
    page.get_by_test_id("reset-submit").click()
    page.wait_for_timeout(1200)

    page.goto(f"{BASE}/account", wait_until="domcontentloaded")
    expect(page.get_by_test_id("account-email").first).to_contain_text(mail)
