"""One running frontend serves two domains without mixing their public content."""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import pytest
from playwright.sync_api import expect

from conftest import BASE


def read(path, host, **headers):
    # Connect only to the local acceptance server; Host simulates the production domain.
    assert BASE.startswith(("http://127.0.0.1:", "http://localhost:"))
    request = urllib.request.Request(BASE + path, headers={"Host": host, **headers})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read().decode(), response.headers


@pytest.mark.parametrize("path", ["/", "/encyclopedia/arcanum/4", "/meaning", "/contacts"])
@pytest.mark.parametrize("host,locale", [("arcana-sense.ru", "ru"), ("arcana-sense.com", "en")])
def test_public_html_and_metadata_depend_only_on_domain(path, host, locale):
    for agent in ["Mozilla/5.0", "Googlebot", "YandexBot"]:
        foreign = "en" if locale == "ru" else "ru"
        html, headers = read(path, host, **{
            "User-Agent": agent, "Accept-Language": foreign, "Cookie": f"arcana_locale={foreign}",
            "X-Forwarded-Host": "attacker.example", "X-Arcana-Interactive": "1", "X-Arcana-Path": "/account",
        })
        assert re.search(fr'<html[^>]*lang="{locale}"', html)
        canonical = re.search(r'<link rel="canonical" href="([^"]+)"', html).group(1)
        assert canonical.rstrip("/") == f"https://{host}{path}".rstrip("/")
        title = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S).group(1)
        assert bool(re.search("[А-Яа-я]", title)) == (locale == "ru"), title
        assert "no-store" in headers.get("Cache-Control", "")
        if path == "/encyclopedia/arcanum/4":
            objects = [json.loads(item) for item in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html)]
            article = next(item for item in objects if item.get("@type") == "Article")
            assert article["inLanguage"] == locale
            assert article["publisher"]["url"] == f"https://{host}"
            assert article["mainEntityOfPage"]["@id"] == f"https://{host}{path}"


def test_interleaved_hosts_do_not_share_rendered_language_or_canonical():
    def check(i):
        host, locale = ("arcana-sense.ru", "ru") if i % 2 else ("arcana-sense.com", "en")
        html, _ = read("/encyclopedia/arcanum/4", host)
        assert f'<html lang="{locale}"' in html
        assert f'<link rel="canonical" href="https://{host}/encyclopedia/arcanum/4"' in html
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check, range(12)))


@pytest.mark.parametrize("host", ["arcana-sense.ru", "arcana-sense.com"])
def test_sitemap_and_robots_are_specific_to_host(host):
    xml, _ = read("/sitemap.xml", host, Cookie="arcana_locale=ru", **{"Accept-Language": "ru"})
    urls = re.findall(r"<loc>(.*?)</loc>", xml)
    assert len(urls) > 300
    assert all(url.startswith(f"https://{host}/") for url in urls)
    robots, _ = read("/robots.txt", host)
    assert f"Sitemap: https://{host}/sitemap.xml" in robots


@pytest.mark.parametrize("agent", ["Mozilla/5.0", "Googlebot", "YandexBot"])
def test_rendered_page_without_explicit_choice_uses_domain_default(browser, agent):
    with browser.new_context(locale="ru-RU", user_agent=agent) as context:
        page = context.new_page()
        page.goto(BASE + "/encyclopedia/arcanum/4?lang=ru")
        expect(page.locator("html")).to_have_attribute("lang", "en")
        expect(page.locator("h1")).to_have_text("4 in the destiny matrix: The Emperor")
        assert "lang=" not in page.url
        assert not any(cookie["name"] == "arcana_locale" for cookie in context.cookies())
        # A real interaction confirms hydration; automatic browser language never wins.
        page.get_by_test_id("language-ru").click()
        expect(page.locator("html")).to_have_attribute("lang", "ru")
        expect(page.locator("h1")).to_contain_text("Император")


def test_choice_survives_navigation_reload_and_another_tab(page):
    page.goto(BASE + "/encyclopedia/arcanum/4")
    page.get_by_test_id("language-ru").click()
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    page.locator('header a[href="/encyclopedia"]').click()
    expect(page.locator("h1")).to_contain_text("Энциклопедия")
    page.reload()
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    other = page.context.new_page()
    other.goto(BASE + "/encyclopedia/arcanum/4")
    expect(other.locator("html")).to_have_attribute("lang", "ru")
    other.get_by_test_id("language-en").click()
    expect(page.locator("html")).to_have_attribute("lang", "en")
    expect(page.locator("h1")).to_have_text("Destiny matrix encyclopedia")


def test_russian_domain_ignores_foreign_preference_and_has_no_switch(browser):
    with browser.new_context(locale="en-US") as context:
        context.add_cookies([{"name": "arcana_locale", "value": "en", "url": "http://localhost:3000"}])
        page = context.new_page()
        page.goto("http://localhost:3000/encyclopedia/arcanum/4?lang=en")
        expect(page.locator("html")).to_have_attribute("lang", "ru")
        expect(page.locator("h1")).to_contain_text("Император")
        expect(page.locator(".language-switch")).to_have_count(0)


def test_unknown_host_is_rejected():
    with pytest.raises(urllib.error.HTTPError) as error:
        read("/", "unknown.example", **{"X-Forwarded-Host": "arcana-sense.com"})
    assert error.value.code == 421
