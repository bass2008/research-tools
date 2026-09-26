"""Remaining translation regressions: admin state, domain documents and provider errors."""
import re

import pytest
from playwright.sync_api import expect

import flows
from conftest import ADMIN, BASE
from test_runtime_localization import switch


def admin_login(page):
    response = page.request.post(BASE + "/api/auth/login", data={"email": ADMIN[0], "password": ADMIN[1]})
    assert response.ok, response.text()
    page.context.add_cookies([{"name": "arcana_locale", "value": "en", "url": BASE}])


def test_admin_switch_keeps_filters_settings_and_document(page):
    admin_login(page)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "/admin")
    expect(page.locator("h1")).to_have_text("Admin")
    page.get_by_test_id("admin-user-row").first.wait_for()
    page.get_by_test_id("users-size").select_option("25")
    page.get_by_test_id("audit-tab-failed").click()
    page.get_by_test_id("admin-settings-toggle").click()
    page.get_by_test_id("admin-settings-frontend").wait_for()
    page.evaluate("window.localeDocumentMarker = 'same-document'")
    for locale, title, source in [("ru", "Админка", "ИСТОЧНИК"), ("en", "Admin", "SOURCE")]:
        switch(page, locale)
        expect(page.locator("h1")).to_have_text(title)
        expect(page.get_by_test_id("users-size")).to_have_value("25")
        expect(page.get_by_test_id("audit-tab-failed")).to_have_attribute("aria-pressed", "true")
        expect(page.get_by_test_id("admin-settings-toggle")).to_have_attribute("aria-expanded", "true")
        expect(page.get_by_test_id("admin-settings-frontend")).to_contain_text(re.compile(source, re.I))
        assert page.evaluate("window.localeDocumentMarker") == "same-document"
    expect(page.get_by_test_id("admin-payments")).to_contain_text("Full reading for one date")
    assert errors == []


def test_admin_open_form_and_error_switch_without_reposting(page):
    admin_login(page)
    page.goto(BASE + "/admin")
    page.get_by_test_id("user-actions").first.click()
    page.get_by_test_id("action-grant").click()
    page.get_by_test_id("grant-day").select_option("17")
    page.get_by_test_id("grant-month").select_option("3")
    calls = []
    def reject(route):
        calls.append(route.request.post_data)
        route.fulfill(status=400, json={"detail": "User not found", "messages": {
            "ru": "Пользователь не найден", "en": "User not found"}})
    page.route("**/api/admin/matrices", reject)
    page.get_by_test_id("grant-submit").click()
    expect(page.get_by_test_id("grant-dialog")).to_contain_text("User not found")
    # Another tab can change the language while the dialog is open.
    second = page.context.new_page()
    second.goto(BASE + "/login")
    switch(second, "ru")
    page.bring_to_front()
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    expect(page.get_by_test_id("grant-dialog")).to_contain_text("Пользователь не найден")
    expect(page.get_by_test_id("grant-day")).to_have_value("17")
    expect(page.get_by_test_id("grant-month")).to_have_value("3")
    expect(page.locator("#grant-m option:checked")).to_have_text("Март")
    assert len(calls) == 1
    second.close()


def test_admin_user_card_switches_loaded_data(page, mail):
    # Своя карта с автоматическим названием: список из первых 200 аккаунтов не обязан
    # содержать администратора, а его реальные названия не обязаны быть переводимыми.
    response = page.request.post(BASE + "/api/auth/register", data={"email": mail, "password": "123"})
    assert response.ok, response.text()
    user = page.request.get(BASE + "/api/auth/me").json()["user"]
    saved = page.request.post(BASE + "/api/matrices", data={"birth": "1993-03-31", "sex": "f"})
    assert saved.ok, saved.text()
    admin_login(page)
    page.goto(BASE + f"/admin/users/{user['id']}")
    expect(page.locator("main")).to_contain_text("Profile")
    expect(page.get_by_test_id("admin-user-matrices")).to_contain_text("Chart of")
    switch(page, "ru")
    expect(page.get_by_test_id("admin-user-matrices")).to_contain_text("Матрица")
    switch(page, "en")
    expect(page.get_by_test_id("admin-user-matrices")).to_contain_text("Chart of")
    assert not re.search("[А-Яа-я]", page.locator("main").inner_text())


@pytest.mark.parametrize("path,title", [("terms", "Условия использования"),
                                          ("privacy", "Политика конфиденциальности"),
                                          ("refund", "Условия возврата")])
def test_legal_translation_keeps_international_document(page, path, title):
    page.context.add_cookies([{"name": "arcana_locale", "value": "en", "url": BASE}])
    page.goto(BASE + "/" + path)
    original_headings = page.locator("h2").all_text_contents()
    expect(page.locator("main")).to_contain_text("20 September 2026")
    assert not re.search("[А-Яа-я]", page.locator("main").inner_text())
    switch(page, "ru")
    expect(page.locator("h1")).to_have_text(title)
    expect(page.locator("main")).to_contain_text("20 сентября 2026")
    assert len(page.locator("h2").all_text_contents()) == len(original_headings)
    text = page.locator("main").inner_text()
    assert "ИНН" not in text and "ОГРНИП" not in text and "September" not in text
    assert "Arcana Sense" in text
    switch(page, "en")
    expect(page.locator("main")).to_contain_text("20 September 2026")
    assert page.locator("h2").all_text_contents() == original_headings


@pytest.mark.usefixtures("multilingual_checkout")
def test_provider_error_switches_without_repeating_payment(page, mail):
    page.context.add_cookies([{"name": "arcana_locale", "value": "ru", "url": BASE}])
    flows.calculate(page, 31, 3, 1993)
    flows.open_pay(page)
    page.get_by_test_id("pay-email").fill(mail)
    page.get_by_test_id("pay-password").fill("123")
    page.locator(".consent input").check()
    messages = {"ru": "Платёжный провайдер отклонил запрос (код 123).",
                "en": "The payment provider rejected the request (code 123)."}
    calls = []
    def fail(route):
        calls.append(route.request.post_data)
        route.fulfill(status=502, json={"detail": messages["ru"], "messages": messages})
    page.route("**/api/payments/start", fail)
    page.get_by_test_id("pay-submit").click()
    error = page.locator(".err").first
    expect(error).to_contain_text(messages["ru"])
    switch(page, "en")
    expect(error).to_contain_text(messages["en"])
    expect(page.get_by_test_id("pay-email")).to_have_value(mail)
    expect(page.locator(".consent input")).to_be_checked()
    assert len(calls) == 1


@pytest.mark.parametrize("path", ["/terms", "/privacy", "/refund"])
@pytest.mark.parametrize("host,locale", [("arcana-sense.ru", "ru"), ("arcana-sense.com", "en")])
def test_legal_public_html_uses_domain_language(path, host, locale):
    from html import unescape
    from test_domain_localization import read
    foreign = "ru" if locale == "en" else "en"
    for agent in ("Mozilla/5.0", "Googlebot", "YandexBot"):
        html, _ = read(path, host, **{"User-Agent": agent, "Accept-Language": foreign,
                                     "Cookie": f"arcana_locale={foreign}"})
        assert re.search(fr'<html[^>]*lang="{locale}"', html)
        main = re.search(r"<main[^>]*>(.*?)</main>", html, re.S).group(1)
        main = unescape(re.sub(r"<[^>]+>", " ", main))
        if locale == "en":
            assert not re.search("[А-Яа-я]", main), main
            assert "20 September 2026" in main
        else:
            assert "20 сентября 2026" in main
            assert "ИП Бородаенко" in main
        assert f'href="https://{host}{path}"' in html
