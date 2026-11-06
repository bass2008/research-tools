"""Колокольчик содержит только непрочитанное, кабинет сохраняет историю."""
import re

import pytest
from playwright.sync_api import expect

from conftest import ADMIN, BASE


@pytest.mark.parametrize("locale", ["ru", "en"])
def test_bell_hides_read_notifications_but_account_keeps_them(page, mail, locale):
    en = locale == "en"

    def login(email, password):
        page.goto(f"{BASE}/{locale}/login")
        page.get_by_test_id("auth-email").fill(email)
        page.get_by_test_id("auth-password").fill(password)
        page.get_by_test_id("auth-submit").click()
        expect(page.locator(".cabinet-heading")).to_be_visible()

    def logout():
        page.get_by_test_id("logout").click()
        expect(page.get_by_test_id("nav-login")).to_be_visible()
        page.wait_for_url(re.compile(r"/(?:(?:ru|en)/?)?$"))

    page.goto(f"{BASE}/{locale}/register")
    page.get_by_test_id("auth-email").fill(mail)
    page.get_by_test_id("auth-password").fill("test-123")
    page.locator("input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    expect(page.locator(".cabinet-heading")).to_be_visible()
    logout()
    login(*ADMIN)
    page.get_by_role("link", name="Go to administration" if en else "Перейти в админку").click()
    row = page.locator("tr").filter(has_text=mail).filter(has=page.get_by_test_id("user-actions"))
    row.get_by_test_id("user-actions").click()
    page.get_by_test_id("action-grant").click()
    page.get_by_test_id("grant-submit").click()
    expect(page.get_by_test_id("grant-done")).to_be_visible()
    row.get_by_test_id("user-actions").click()
    page.get_by_test_id("action-grant-subscription").click()
    expect(page.get_by_test_id("grant-subscription-done")).to_be_visible()
    logout()
    login(mail, "test-123")

    page.locator(".cabinet-tabs").get_by_role("button", name="Notifications" if en else "Уведомления").click()
    cards = page.locator(".notification-card")
    expect(cards).to_have_count(2)
    bell = page.locator(".notification-bell")
    bell.click()
    popup = page.locator(".notification-popover")
    previews = popup.locator(".notification-preview")
    expect(previews).to_have_count(2)
    read_title = previews.first.locator("strong").inner_text()
    previews.first.get_by_role("button", name="Mark as read" if en else "Прочитать", exact=True).click()
    expect(previews).to_have_count(1)
    expect(popup).not_to_contain_text(read_title)
    expect(cards).to_have_count(2)
    expect(page.locator(".notification-card.unread")).to_have_count(1)
    expect(bell).to_contain_text("1")

    popup.get_by_role("button", name="Close notifications" if en else "Закрыть уведомления").click()
    bell.click()
    expect(previews).to_have_count(1)
    popup.get_by_role("button", name="Read all" if en else "Прочитать всё", exact=True).click()
    expect(previews).to_have_count(0)
    expect(popup).to_contain_text("No unread notifications" if en else "Нет непрочитанных уведомлений")
    expect(cards).to_have_count(2)
    expect(page.locator(".notification-card.unread")).to_have_count(0)
    expect(bell.locator("span")).to_have_count(0)

    page.reload()
    page.locator(".cabinet-tabs").get_by_role("button", name="Notifications" if en else "Уведомления").click()
    expect(cards).to_have_count(2)
    bell.click()
    expect(previews).to_have_count(0)
    expect(popup).to_contain_text("No unread notifications" if en else "Нет непрочитанных уведомлений")
