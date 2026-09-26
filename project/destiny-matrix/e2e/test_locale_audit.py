"""Localization regressions found during the extended local audit."""
import re
import pytest
from playwright.sync_api import expect

from conftest import BASE
from test_runtime_localization import switch


@pytest.mark.parametrize("path", ["/login", "/encyclopedia/arcanum/4"])
def test_language_event_updates_another_tab_before_cookie_cache_catches_up(page, path):
    page.goto(BASE + path)
    expect(page.get_by_test_id("language-ru")).to_be_enabled()
    page.evaluate("window.localeDocumentMarker = 'same-document'")
    other = page.context.new_page()
    try:
        other.goto(BASE + "/login")
        for locale in ["ru", "en"] * 3:
            switch(other, locale)
            expect(page.locator("html")).to_have_attribute("lang", locale)
            expect(page.get_by_test_id("nav-account")).to_have_text("Кабинет" if locale == "ru" else "Account")
            assert page.evaluate("window.localeDocumentMarker") == "same-document"
    finally:
        other.close()


def test_storage_notification_is_used_when_document_cookie_is_temporarily_stale(page):
    page.goto(BASE + "/login")
    expect(page.get_by_test_id("language-ru")).to_be_enabled()
    page.context.add_cookies([{"name": "arcana_locale", "value": "ru", "url": BASE}])
    # Reproduce the renderer's observed old cookie value at the instant of storage dispatch;
    # the network cookie jar already contains the new choice, as with two real browser tabs.
    page.evaluate("""() => {
      Object.defineProperty(document, 'cookie', {get: () => '', configurable: true});
      window.dispatchEvent(new StorageEvent('storage', {key: 'arcana_locale', newValue: 'ru'}));
      delete document.cookie;
    }""")
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    expect(page.get_by_test_id("nav-account")).to_have_text("Кабинет")


@pytest.mark.parametrize("locale", ["ru", "en"])
@pytest.mark.parametrize("query", ["", "?token=expired-localization-pass"])
def test_pdf_error_document_uses_site_choice_not_browser_language(browser, locale, query):
    context = browser.new_context(locale="ru-RU" if locale == "en" else "en-US")
    try:
        context.add_cookies([{"name": "arcana_locale", "value": locale, "url": BASE}])
        page = context.new_page()
        response = page.goto(BASE + "/api/reports/file" + query)
        assert response.status == (403 if query else 400)
        assert response.headers["content-language"] == locale
        text = page.locator("body").inner_text()
        assert bool(re.search("[А-Яа-яЁё]", text)) == (locale == "ru")
    finally:
        context.close()
