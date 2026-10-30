"""User pages use URL locales; technical endpoints and payment hosts do not move."""
from __future__ import annotations

import re
from urllib.parse import urlsplit

import pytest
from playwright.sync_api import expect

from conftest import BASE


@pytest.mark.parametrize("host", ["arcana-sense.ru", "arcana-sense.com"])
@pytest.mark.parametrize("locale", ["ru", "en"])
def test_private_html_redirects_and_parameters(page, host, locale):
    paths = ["/login", "/register", "/forgot", "/reset?token=old-token", "/account", "/admin",
             "/report", "/pay", "/pay/single", "/pay/done?order=old-order", "/pay/fail?order=old-order",
             "/matrix", "/matrix/1-1-2"]
    headers = {"Host": host, "User-Agent": "YandexBot", "Cookie": f"arcana_locale={'en' if locale == 'ru' else 'ru'}"}
    for path in paths:
        old = page.request.get(BASE + path + ("&" if "?" in path else "?") + f"lang={locale}",
                               headers=headers, max_redirects=0)
        assert old.status == 302, (path, old.status)
        assert old.headers["location"] == f"https://{host}/{locale}{path}"
        new = page.request.get(BASE + f"/{locale}" + path, headers=headers, max_redirects=0)
        assert new.status == 200, (path, new.status)
        html = new.text()
        assert re.search(fr'<html[^>]*lang="{locale}"', html), path
        assert "noindex" in new.headers.get("x-robots-tag", ""), path
        # Account links must already contain the language, without a redirect hop.
        assert f'href="/{locale}/account"' in html, path
    for path in ["/ru/api/auth/me", "/en/robots.txt", "/ru/version/current.txt", "/en/no-such-page"]:
        assert page.request.get(BASE + path, headers=headers, max_redirects=0).status == 404


@pytest.mark.parametrize("width", [1360, 390])
def test_private_switch_preserves_form_host_and_url_locale_across_tabs(page, width):
    page.set_viewport_size({"width": width, "height": 844})
    page.goto(BASE + "/en/login?next=account#content")
    page.get_by_test_id("auth-email").fill("preserved@example.test")
    page.get_by_test_id("auth-password").fill("unsent-password")
    page.get_by_test_id("language-ru").click()
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    assert page.url == BASE + "/ru/login?next=account#content"
    expect(page.get_by_test_id("auth-email")).to_have_value("preserved@example.test")
    expect(page.get_by_test_id("auth-password")).to_have_value("unsent-password")
    other = page.context.new_page()
    other.goto(BASE + "/en/login")
    expect(other.locator("html")).to_have_attribute("lang", "en")
    page.bring_to_front()
    page.reload()
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    expect(page.get_by_test_id("nav-register")).to_have_attribute("href", "/ru/register")
    page.locator('main a[href="/ru/register"]').click()
    page.wait_for_url(BASE + "/ru/register")
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    other.close()

@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://127.0.0.1:3000"])
def test_public_switch_stays_on_origin_and_translates_reported_article(page, origin):
    path = "/encyclopedia/position/comfort_west"
    page.goto(origin + "/ru" + path + "?tab=meaning#content")
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    russian = page.locator("h1").inner_text()
    page.get_by_test_id("language-en").click()
    expect(page.locator("html")).to_have_attribute("lang", "en")
    assert page.url == origin + "/en" + path + "?tab=meaning#content"
    assert page.locator("h1").inner_text() != russian
    expect(page.locator('header a[href="/en/encyclopedia"]')).to_be_visible()
    page.reload()
    expect(page.locator("html")).to_have_attribute("lang", "en")
    page.locator('header a[href="/en/encyclopedia"]').click()
    page.wait_for_url(origin + "/en/encyclopedia")
    expect(page.locator("html")).to_have_attribute("lang", "en")

@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://127.0.0.1:3000"])
@pytest.mark.parametrize("path", ["/encyclopedia/arcanum/99", "/not-a-real-page"])
def test_404_document_and_switch_keep_url_language(page, origin, path):
    page.context.add_cookies([{"name": "arcana_locale", "value": "ru", "url": origin}])
    response = page.goto(origin + "/en" + path + "?tab=x#content")
    assert response.status == 404
    expect(page.locator("html")).to_have_attribute("lang", "en")
    expect(page).to_have_title("Page not found")
    page.get_by_test_id("language-ru").click()
    page.wait_for_url(origin + "/ru" + path + "?tab=x#content")
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    expect(page).to_have_title("Страница не найдена")
    page.context.add_cookies([{"name": "arcana_locale", "value": "en", "url": origin}])
    assert page.reload().status == 404
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    expect(page.locator('link[rel="canonical"]')).to_have_count(0)
    page.locator('header a[href="/ru/encyclopedia"]').click()
    page.wait_for_url(origin + "/ru/encyclopedia")
    expect(page.locator("html")).to_have_attribute("lang", "ru")


@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://127.0.0.1:3000"])
def test_translated_legal_pages_keep_their_seller_canonical(page, origin):
    for locale in ["ru", "en"]:
        for path in ["/terms", "/privacy", "/refund", "/contacts", "/support"]:
            url = origin + "/" + locale + path
            page.goto(url)
            expect(page.locator("html")).to_have_attribute("lang", locale)
            expect(page.locator('link[rel="canonical"]')).to_have_attribute("href", url)
            for lang in ["ru", "en"]:
                expect(page.locator(f'link[hreflang="{lang}"]')).to_have_attribute("href", origin + "/" + lang + path)


@pytest.mark.parametrize("engine", ["chromium", "firefox"])
@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://127.0.0.1:3000"])
@pytest.mark.parametrize("initial", ["ru", "en"])
def test_history_across_language_switch_restores_page_and_layout(playwright_engine, engine, origin, initial):

    other = "en" if initial == "ru" else "ru"
    browser = getattr(playwright_engine, engine).launch()
    try:
        page = browser.new_page()
        hub = f"{origin}/{initial}/encyclopedia/arcanum"
        page.goto(hub)
        initial_heading = page.locator("h1").inner_text()
        initial_header = page.locator("header nav").inner_text()
        page.locator(f'main a[href="/{initial}/encyclopedia/arcanum/4"]').first.click()
        page.wait_for_url(f"{hub}/4")
        page.get_by_test_id(f"language-{other}").click()
        expect(page.locator("html")).to_have_attribute("lang", other)
        switched_heading = page.locator("h1").inner_text()
        switched_header = page.locator("header nav").inner_text()
        assert switched_header != initial_header
        page.go_back()
        page.wait_for_url(hub)
        expect(page.locator("html")).to_have_attribute("lang", initial)
        expect(page.locator("header nav")).to_have_text(initial_header, use_inner_text=True)
        expect(page.locator("h1")).to_have_text(initial_heading)
        expect(page.locator('header a[href$="/encyclopedia"]')).to_have_attribute("href", f"/{initial}/encyclopedia")
        page.go_forward()
        page.wait_for_url(f"{origin}/{other}/encyclopedia/arcanum/4")
        expect(page.locator("html")).to_have_attribute("lang", other)
        expect(page.locator("header nav")).to_have_text(switched_header, use_inner_text=True)
        expect(page.locator("h1")).to_have_text(switched_heading)
        page.reload()
        expect(page.locator("html")).to_have_attribute("lang", other)
    finally:
        browser.close()
