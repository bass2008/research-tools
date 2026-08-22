"""Деньги: платёж открывает выбранное, не открывает лишнего и не проходит дважды."""
from __future__ import annotations

from playwright.sync_api import expect

import flows
from conftest import ADMIN, BASE


def test_buying_a_locked_date_from_account_opens_that_date(page, mail):
    """В кабинете лежит закрытая дата; «Открыть» из её карточки должно оплатить именно её."""
    flows.register(page, mail)
    flows.calculate(page, 12, 12, 1988)
    flows.save_current(page)

    card = flows.matrix_cards(page).first
    assert "12 декабря 1988" in card.inner_text()
    card.get_by_role("link", name="Открыть").click()
    expect(page.get_by_test_id("pay-submit")).to_contain_text("12 декабря 1988")

    flows.pay(page, mail)
    expect(page.get_by_test_id("paid-matrix")).to_contain_text("12 декабря 1988")
    flows.account(page)
    assert "куплена" in flows.matrix_cards(page).first.inner_text().lower()


def test_refund_by_admin_closes_the_access(page, mail):
    flows.buy(page, mail, 13, 1, 1989)
    flows.account(page)
    assert "куплена" in flows.matrix_cards(page).first.inner_text().lower()

    flows.logout(page)
    flows.login(page, *ADMIN)
    rows = page.request.get(f"{BASE}/api/admin/payments").json()["items"]
    mine = next(r for r in rows if r["email"] == mail)
    answer = page.request.post(f"{BASE}/api/admin/payments/{mine['id']}/refund")
    assert answer.ok, answer.text()

    flows.logout(page)
    flows.login(page, mail)
    flows.account(page)
    card = flows.matrix_cards(page).first.inner_text().lower()
    assert "куплена" not in card, card


def test_paying_for_another_email_while_signed_in_is_stopped(page, mail):
    flows.register(page, mail)
    flows.calculate(page, 14, 2, 1990)
    flows.open_pay(page)
    page.get_by_test_id("pay-email").fill("someone-else@example.ru")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    page.wait_for_timeout(1200)
    expect(page.locator(".err")).to_contain_text("вошли как")
    assert page.get_by_test_id("paid-matrix").count() == 0


def test_double_click_makes_one_payment(page, mail):
    flows.calculate(page, 15, 3, 1991)
    flows.open_pay(page)
    page.get_by_test_id("pay-email").fill(mail)
    page.get_by_test_id("pay-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    button = page.get_by_test_id("pay-submit")
    button.click()
    button.click(force=True, timeout=2000)
    page.wait_for_function(
        "() => document.querySelector('[data-testid=paid-matrix]') || document.querySelector('.err')",
        timeout=60_000)
    flows.account(page)
    rows = page.get_by_test_id("payment-row")
    assert rows.count() == 1, f"платежей {rows.count()}"


def test_consent_is_required(page, mail):
    flows.calculate(page, 16, 4, 1992)
    flows.open_pay(page)
    page.get_by_test_id("pay-email").fill(mail)
    page.get_by_test_id("pay-password").fill("1234")
    page.get_by_test_id("pay-submit").click()
    page.wait_for_timeout(900)
    expect(page.locator(".err")).to_contain_text("согласие")
    assert page.get_by_test_id("paid-matrix").count() == 0


def test_short_password_is_refused(page, mail):
    flows.calculate(page, 17, 5, 1993)
    flows.open_pay(page)
    page.get_by_test_id("pay-email").fill(mail)
    page.get_by_test_id("pay-password").fill("12")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    page.wait_for_timeout(900)
    expect(page.locator(".err")).to_contain_text("Пароль")
    assert page.get_by_test_id("paid-matrix").count() == 0


def test_broken_email_is_refused(page):
    """Почту без собаки не пропускает сам браузер (поле type=email), платёж не начинается."""
    flows.calculate(page, 18, 6, 1994)
    flows.open_pay(page)
    page.get_by_test_id("pay-email").fill("почта-без-собаки")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    page.wait_for_timeout(900)
    assert page.get_by_test_id("paid-matrix").count() == 0
    assert page.get_by_test_id("pay-submit").count() == 1, "форма ушла с невалидной почтой"
    assert page.evaluate("() => document.querySelector('[data-testid=pay-email]').checkValidity()") is False


def test_storage_limit_is_explained(page, mail):
    """Бесплатная дата одна: вторая без покупки не сохраняется, и об этом говорят словами."""
    flows.register(page, mail)
    flows.calculate(page, 19, 7, 1995)
    flows.save_current(page)
    flows.calculate(page, 20, 8, 1996)
    flows.account(page)
    page.get_by_test_id("save-matrix").click()
    page.wait_for_timeout(1500)
    expect(page.get_by_test_id("limit-message")).to_be_visible()
    assert flows.matrix_cards(page).count() == 1


def test_after_refund_the_report_is_closed_again(page, mail):
    """Возврат закрывает не только карточку в кабинете, но и сам разбор."""
    flows.buy(page, mail, 23, 2, 1990)
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(1200)
    assert flows.locked_sections(page) == 0, "разбор не открылся после покупки"
    matrix_id = flows.matrix_ids(page)[0]

    flows.logout(page)
    flows.login(page, *ADMIN)
    rows = page.request.get(f"{BASE}/api/admin/payments").json()["items"]
    mine = next(r for r in rows if r["email"] == mail)
    assert page.request.post(f"{BASE}/api/admin/payments/{mine['id']}/refund").ok

    flows.logout(page)
    flows.login(page, mail)
    page.goto(f"{BASE}/matrices/{matrix_id}", wait_until="networkidle")
    page.wait_for_timeout(900)
    assert flows.locked_sections(page) > 0, "платные разделы остались открытыми после возврата"
    assert "куплена" not in page.inner_text("main").lower()

    if page.get_by_test_id("save-pdf").count():
        button = page.get_by_test_id("save-pdf")
        expect(button).to_be_enabled(timeout=20_000)
        button.click()
        expect(page.get_by_test_id("pdf-error")).to_be_visible(timeout=60_000)
