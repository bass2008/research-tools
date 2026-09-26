"""Regression checks for the global-404 reload loop and readable role names."""
import re

import pytest
from playwright.sync_api import expect

from conftest import ADMIN, BASE
from test_runtime_localization import switch


@pytest.mark.parametrize("initial", ["en", "ru"])
@pytest.mark.parametrize("width", [1360, 390])
def test_global_404_switches_without_navigation(page, initial, width):
    page.set_viewport_size({"width": width, "height": 900})
    page.context.add_cookies([{"name": "arcana_locale", "value": initial, "url": BASE}])
    documents, errors, flights = [], [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: documents.append(request.url)
            if request.is_navigation_request() and request.frame == page.main_frame else None)
    page.on("request", lambda request: flights.append(request.url)
            if request.headers.get("rsc") == "1" else None)
    response = page.goto(BASE + "/missing-localization-regression")
    assert response.status == 404
    expect(page.locator("html")).to_have_attribute("lang", initial)
    page.evaluate("window.localeDocumentMarker = 'same-document'")
    for locale in (["ru", "en", "ru"] if initial == "en" else ["en", "ru"]):
        switch(page, locale)
        expect(page.locator("h1")).to_have_text("Такой страницы нет" if locale == "ru" else "This page does not exist")
        expect(page.get_by_test_id("nav-account")).to_have_text("Кабинет" if locale == "ru" else "Account")
        assert bool(re.search("[А-Яа-я]", page.title())) == (locale == "ru")
        assert page.evaluate("window.localeDocumentMarker") == "same-document"
    page.wait_for_timeout(1500)  # The old bug produced dozens of navigations in this interval.
    assert len(documents) == 1, documents
    assert flights == []
    assert errors == []
    assert page.reload().status == 404
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    page.wait_for_timeout(500)
    assert len(documents) == 2, documents
    assert flights == []
    page.locator("main a[href='/']").click()
    expect(page.locator("#d")).to_be_visible()
    expect(page.locator("html")).to_have_attribute("lang", "ru")


def test_global_404_follows_another_tabs_choice(page):
    page.goto(BASE + "/missing-localization-regression")
    expect(page.locator("html")).to_have_attribute("lang", "en")
    page.evaluate("window.localeDocumentMarker = 'same-document'")
    other = page.context.new_page()
    try:
        other.goto(BASE + "/login")
        for locale in ["ru", "en"] * 3:
            switch(other, locale)
            expect(page.locator("html")).to_have_attribute("lang", locale)
            expect(page.locator("h1")).to_have_text("Такой страницы нет" if locale == "ru" else "This page does not exist")
            assert page.evaluate("window.localeDocumentMarker") == "same-document"
    finally:
        other.close()


@pytest.mark.parametrize("origin,locale", [(BASE, "en"), ("http://localhost:3000", "ru")])
def test_global_404_html_keeps_domain_language_without_javascript(browser, origin, locale):
    context = browser.new_context(java_script_enabled=False)
    try:
        context.add_cookies([{"name": "arcana_locale", "value": "ru" if locale == "en" else "en", "url": origin}])
        page = context.new_page()
        response = page.goto(origin + "/missing-localization-regression")
        assert response.status == 404
        expect(page.locator("html")).to_have_attribute("lang", locale)
        expect(page.locator("h1")).to_have_text("Такой страницы нет" if locale == "ru" else "This page does not exist")
        for robots in page.locator('meta[name="robots"]').all():
            expect(robots).to_have_attribute("content", re.compile("noindex"))
        if locale == "ru":
            expect(page.locator(".language-switch")).to_have_count(0)
        else:
            assert not re.search("[А-Яа-яЁё]", page.locator("body").inner_text().replace("Русская версия", ""))
    finally:
        context.close()


@pytest.mark.parametrize("section,slug", [
    ("family_gifts", "2-20-6-6"), ("realisation", "21-6-12"),
    ("soul_tasks", "1-21-22"), ("purpose", "6-12-18-3"),
    ("money", "7-5-16-20"), ("ancestry", "22-6-6-3"),
])
def test_article_role_names_switch_in_place(page, section, slug):
    login = page.request.post(BASE + "/api/auth/login", data={"email": ADMIN[0], "password": ADMIN[1]})
    assert login.ok, login.text()
    page.context.add_cookies([{"name": "arcana_locale", "value": "ru", "url": BASE}])
    page.goto(BASE + f"/encyclopedia/{section}/{slug}")
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    reading = page.locator(".character-reading")
    expect(reading).to_be_visible()
    internal = re.compile(r"\b(?:total_[mf]|task_[mf]|sky_total|ground_total|physics_total|energy_total|emotions_total)\b")
    ru = reading.inner_text()
    assert not internal.search(ru)
    assert not re.search(r"\b(?:personal|social|spiritual|planetary)\b", ru)
    if section == "family_gifts":
        expect(page.locator(".character-summary")).to_contain_text("Дар мужской ветви")
        expect(page.locator(".character-summary")).to_contain_text("Дар женской ветви")
    page.evaluate("window.localeDocumentMarker = 'same-document'")
    switch(page, "en")
    assert not internal.search(reading.inner_text())
    assert not re.search("[А-Яа-яЁё]", reading.inner_text())
    switch(page, "ru")
    expect(reading).to_have_text(ru, use_inner_text=True)
    assert page.evaluate("window.localeDocumentMarker") == "same-document"
