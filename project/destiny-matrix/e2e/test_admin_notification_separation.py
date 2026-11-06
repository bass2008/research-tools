"""Личные уведомления администратора не содержат сообщений об оплатах клиентов."""
import random
import re

from playwright.sync_api import expect

from conftest import ADMIN, BASE


def test_admin_payment_notifications_stay_in_admin(page, mail):
    page.goto(f"{BASE}/ru/pay/month")
    page.get_by_test_id("pay-email").fill(mail)
    page.get_by_test_id("pay-password").fill("test-123")
    page.locator("input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    expect(page.locator("main").get_by_test_id("account-email")).to_have_text(mail)
    page.get_by_test_id("logout").click()
    expect(page.get_by_test_id("nav-login")).to_be_visible()
    page.wait_for_url(re.compile(r"/(?:(?:ru|en)/?)?$"))

    page.goto(f"{BASE}/ru/login")
    page.get_by_test_id("auth-email").fill(ADMIN[0])
    page.get_by_test_id("auth-password").fill(ADMIN[1])
    page.get_by_test_id("auth-submit").click()
    expect(page.locator(".cabinet-heading")).to_be_visible()
    page.get_by_role("link", name="Перейти в админку").click()
    panel = page.get_by_test_id("admin-notifications")
    payment = panel.locator("tr").filter(has_text=mail).filter(has_text="Новая успешная оплата")
    expect(payment).to_have_count(1)
    expect(payment).to_contain_text("Не прочитано")

    # The stand keeps notifications of earlier runs: start this check with none unread.
    page.goto(f"{BASE}/ru/account?tab=notifications", wait_until="networkidle")
    read_all = page.get_by_role("button", name="Прочитать все", exact=True)
    if read_all.count() and read_all.is_enabled():
        read_all.click()
        expect(page.locator(".notification-card.unread")).to_have_count(0)
    page.get_by_role("link", name="Перейти в админку").click()

    # Give the administrator a personal reading through the normal admin UI.
    # The stand keeps every e2e user; the administrator is the first account, so sort by ID ascending.
    sort_id = page.get_by_test_id("users-sort-id")
    sort_id.click()
    expect(page.locator("th", has=sort_id)).to_have_attribute("aria-sort", "descending")
    sort_id.click()
    expect(page.locator("th", has=sort_id)).to_have_attribute("aria-sort", "ascending")
    row = page.locator("tr").filter(has=page.get_by_test_id("user-actions")).filter(has_text=ADMIN[0])
    row.get_by_test_id("user-actions").click()
    page.get_by_test_id("action-grant").click()
    # A repeated grant of the same date is not a new event, so each run grants a date of its own.
    dialog = page.get_by_test_id("grant-dialog")
    dialog.get_by_test_id("grant-day").select_option(str(random.randint(1, 28)))
    dialog.get_by_test_id("grant-month").select_option(str(random.randint(1, 12)))
    dialog.get_by_test_id("grant-year").select_option(str(random.randint(1950, 2010)))
    page.get_by_test_id("grant-submit").click()
    expect(page.get_by_test_id("grant-done")).to_be_visible()

    page.goto(f"{BASE}/ru/account?tab=notifications")
    cards = page.locator(".notification-card")
    expect(page.locator(".notification-card.unread").filter(has_text="Разбор доступен")).to_have_count(1)
    expect(cards.filter(has_text="Новая успешная оплата")).to_have_count(0)
    bell = page.locator(".notification-bell")
    bell.click()
    popup = page.locator(".notification-popover")
    expect(popup.locator(".notification-preview").filter(has_text="Разбор доступен")).to_have_count(1)
    expect(popup).not_to_contain_text("Новая успешная оплата")
    popup.get_by_role("button", name="Закрыть уведомления").click()
    page.get_by_role("button", name="Прочитать все", exact=True).click()
    expect(page.locator(".notification-card.unread")).to_have_count(0)
    expect(bell.locator("span")).to_have_count(0)
    bell.click()
    expect(popup).to_contain_text("Нет непрочитанных уведомлений")
    popup.get_by_role("button", name="Закрыть уведомления").click()

    page.get_by_role("link", name="Перейти в админку").click()
    expect(payment).to_have_count(1)
    expect(payment).to_contain_text("Не прочитано")
