"""Администратор открывает выданные разборы из уведомлений, сохраняя свою сессию."""
import re

import pytest
from playwright.sync_api import expect

from conftest import ADMIN, BASE


@pytest.mark.parametrize("locale", ["ru", "en"])
@pytest.mark.parametrize("product", ["personal", "pair"])
def test_admin_opens_customer_reading_from_notification(page, mail, locale, product):
    en = locale == "en"
    page.goto(f"{BASE}/{locale}/register")
    page.get_by_test_id("auth-email").fill(mail)
    page.get_by_test_id("auth-password").fill("test-123")
    page.locator("input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    expect(page.locator(".cabinet-heading")).to_be_visible()
    page.get_by_test_id("logout").click()
    expect(page.get_by_test_id("nav-login")).to_be_visible()
    page.get_by_test_id("nav-login").click()
    page.get_by_test_id("auth-email").fill(ADMIN[0])
    page.get_by_test_id("auth-password").fill(ADMIN[1])
    page.get_by_test_id("auth-submit").click()
    admin_link = "Go to administration" if en else "Перейти в админку"
    page.get_by_role("link", name=admin_link).click()
    customer = page.get_by_test_id("admin-user-row").filter(has_text=mail)
    customer.get_by_test_id("user-actions").click()

    if product == "personal":
        page.get_by_test_id("action-grant").click()
        for part, value in [("year", "1998"), ("month", "7"), ("day", "12")]:
            page.get_by_test_id(f"grant-{part}").select_option(value)
        page.get_by_test_id("grant-submit").click()
        expect(page.get_by_test_id("grant-dialog")).to_have_count(0)
    else:
        page.get_by_test_id("action-grant-pair").click()
        for who, values in [("a", ["1998", "7", "12"]), ("b", ["1995", "2", "19"])]:
            for part, value in zip(["year", "month", "day"], values):
                page.get_by_test_id(f"grant-pair-{who}-{part}").select_option(value)
        page.get_by_test_id("grant-pair-submit").click()
        expect(page.get_by_test_id("grant-pair-dialog")).to_have_count(0)

    # Обычный сайт: после выдачи обновляем таблицу уведомлений.
    page.reload()
    panel = page.get_by_test_id("admin-notifications")
    panel.locator("select").first.select_option("reading_available")
    panel.get_by_role("button", name="Apply" if en else "Показать", exact=True).click()
    notification = panel.locator("tbody tr").filter(has_text=mail)
    expect(notification).to_have_count(1)
    notification.get_by_role("link", name=re.compile("Open reading" if en else "Открыть разбор")).click()
    expect(page).to_have_url(re.compile(r"/admin/readings/\d+$"))
    main = page.locator("main")
    expect(main.locator(".crumbs")).to_contain_text(mail)
    expect(main).to_contain_text("12 July 1998" if en else "12 июля 1998")
    if product == "personal":
        expect(page.get_by_test_id("section-chakras")).to_have_attribute("data-locked", "false")
    else:
        expect(main).to_contain_text("19 February 1995" if en else "19 февраля 1995")
        expect(main.locator("[data-locked=true]")).to_have_count(0)
    expect(page.get_by_test_id("save-pdf")).to_have_count(0)
    page.get_by_test_id("nav-account").click()
    expect(page.get_by_test_id("account-email")).to_have_text(ADMIN[0])
    expect(page.get_by_role("link", name=admin_link)).to_be_visible()
