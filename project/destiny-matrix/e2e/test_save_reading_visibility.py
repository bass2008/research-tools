"""Сохранение личного расчёта предлагается только вошедшему пользователю."""
import pytest
from playwright.sync_api import expect

from conftest import BASE


@pytest.mark.parametrize("locale", ["ru", "en"])
def test_save_button_requires_login(page, mail, locale):
    page.goto(f"{BASE}/{locale}")
    for part, value in [("y", "1997"), ("m", "8"), ("d", "16")]:
        page.locator(f"#{part}").select_option(value)
    page.get_by_test_id("calc-submit").click()
    summary = page.locator(".save-reading-summary")
    expect(summary).to_be_visible()
    expect(page.get_by_test_id("save-matrix")).to_have_count(0)
    expect(summary.locator("a, button")).to_have_count(0)

    page.get_by_test_id("nav-login").click()
    page.get_by_role("link", name="Sign up" if locale == "en" else "Зарегистрироваться", exact=True).click()
    expect(page.locator("main h1")).to_have_text("Sign up" if locale == "en" else "Регистрация")
    page.get_by_test_id("auth-email").fill(mail)
    page.get_by_test_id("auth-password").fill("test-123")
    page.locator("input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    expect(page.locator(".cabinet-heading")).to_be_visible()
    page.get_by_role("link", name="Home" if locale == "en" else "Главная", exact=True).first.click()
    expect(summary.get_by_test_id("save-matrix")).to_have_text("Save to account" if locale == "en" else "Сохранить в кабинет")
    expect(summary.get_by_test_id("save-matrix")).to_have_css("background-color", "rgb(184, 144, 42)")
