"""После исправления даты ошибка предыдущей отправки не остаётся на экране."""
import pytest
from playwright.sync_api import expect

from conftest import BASE
import flows


@pytest.mark.parametrize("path,prefix", [
    ("/pay/single", "pay"),
    ("/pay/pair", "pay-a"),
    ("/pay/pair", "pay-b"),
])
def test_corrected_checkout_date_clears_error(page, mail, path, prefix):
    page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
    day = page.get_by_test_id(f"{prefix}-d")
    expect(day).to_be_enabled(timeout=30_000)
    day.select_option("31")
    page.get_by_test_id(f"{prefix}-m").select_option("2")
    page.get_by_test_id(f"{prefix}-y").select_option("1993")
    page.get_by_test_id("pay-email").fill(mail)
    page.get_by_test_id("pay-password").fill("1234")
    flows.agree(page)
    page.get_by_test_id("pay-submit").click()
    error = page.locator(".err[role=alert]")
    expect(error).to_contain_text("28 дней")

    day.select_option("15")
    expect(error).to_have_count(0)
    expect(day).to_have_value("15")
    expect(page.get_by_test_id("pay-submit")).to_be_enabled()

    # Сброс сообщения не отключает проверку при следующей отправке.
    day.select_option("31")
    page.get_by_test_id("pay-submit").click()
    expect(error).to_contain_text("28 дней")
