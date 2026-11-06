"""Ссылки на кабинет переключают открытую вкладку без перезагрузки страницы."""
import re
import pytest
from playwright.sync_api import expect

from conftest import BASE, _credentials


@pytest.fixture
def local_time_page(browser):
    context = browser.new_context(viewport={"width": 1360, "height": 950}, timezone_id="Europe/Moscow",
                                  http_credentials=_credentials())
    page = context.new_page()
    page.set_default_timeout(15_000)
    yield page
    context.close()


@pytest.mark.parametrize("locale", ["ru", "en"])
def test_subscription_notification_opens_readings(local_time_page, mail, locale):
    page = local_time_page
    en = locale == "en"
    page.goto(f"{BASE}/{locale}/register")
    page.get_by_test_id("auth-email").fill(mail)
    page.get_by_test_id("auth-password").fill("test-123")
    page.locator("input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    expect(page.locator(".cabinet-heading")).to_be_visible()

    page.get_by_role("link", name="Get a subscription" if en else "Оформить подписку").click()
    page.get_by_test_id("pay-submit").click()
    expect(page.locator("main").get_by_test_id("account-email")).to_have_text(mail)
    page.get_by_test_id("nav-account").click()
    tabs = page.locator(".cabinet-tabs")
    tabs.get_by_role("button", name="Notifications" if en else "Уведомления").click()
    subscription = page.locator(".notification-card").filter(has_text="Subscription active" if en else "Подписка активна")
    date = re.search(r"\d{2}[./]\d{2}[./]\d{4}", page.get_by_test_id("account-access").inner_text()).group()
    expect(subscription).to_contain_text(date)
    subscription.get_by_role("link", name="My readings →" if en else "Мои разборы →", exact=True).click()
    expect(tabs.locator("[aria-current=page]")).to_have_text("My readings" if en else "Мои разборы")
    expect(page.locator(".cabinet-new button")).to_be_visible()

    tabs.get_by_role("button", name="Profile" if en else "Профиль", exact=True).click()
    page.get_by_test_id("nav-account").click()
    expect(tabs.locator("[aria-current=page]")).to_have_text("My readings" if en else "Мои разборы")
