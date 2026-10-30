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


def public_path(path, locale):
    if path == "/":
        return "/" if locale == "ru" else "/en/"
    return f"/{locale}{path}"


def read(path, host, **headers):
    # Connect only to the local acceptance server; Host simulates the production domain.
    assert BASE.startswith(("http://127.0.0.1:", "http://localhost:"))
    if path == "/" or path.startswith(("/encyclopedia", "/meaning", "/contacts")):
        path = public_path(path, "ru" if host in ("arcana-sense.ru", "localhost:3000") else "en")
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
        assert canonical.rstrip("/") == f"https://{host}{public_path(path, locale)}".rstrip("/")
        title = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S).group(1)
        assert bool(re.search("[А-Яа-я]", title)) == (locale == "ru"), title
        assert "no-store" in headers.get("Cache-Control", "")
        if path == "/encyclopedia/arcanum/4":
            objects = [json.loads(item) for item in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html)]
            article = next(item for item in objects if item.get("@type") == "Article")
            assert article["inLanguage"] == locale
            assert article["publisher"]["url"] == f"https://{host}"
            assert article["mainEntityOfPage"]["@id"] == f"https://{host}{public_path(path, locale)}"


def test_interleaved_hosts_do_not_share_rendered_language_or_canonical():
    def check(i):
        host, locale = ("arcana-sense.ru", "ru") if i % 2 else ("arcana-sense.com", "en")
        html, _ = read("/encyclopedia/arcanum/4", host)
        assert f'<html lang="{locale}"' in html
        assert f'<link rel="canonical" href="https://{host}/{locale}/encyclopedia/arcanum/4"' in html
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check, range(12)))


@pytest.mark.parametrize("host", ["arcana-sense.ru", "arcana-sense.com"])
def test_sitemap_and_robots_are_specific_to_host(host):
    xml, _ = read("/sitemap.xml", host, Cookie="arcana_locale=ru", **{"Accept-Language": "ru"})
    urls = re.findall(r"<loc>(.*?)</loc>", xml)
    assert len(urls) > 200
    assert all(url.startswith(f"https://{host}/") for url in urls)
    robots, _ = read("/robots.txt", host)
    assert f"Sitemap: https://{host}/sitemap.xml" in robots


@pytest.mark.parametrize("agent", ["Mozilla/5.0", "Googlebot", "YandexBot"])
def test_rendered_page_without_explicit_choice_uses_domain_default(browser, agent):
    with browser.new_context(locale="ru-RU", user_agent=agent) as context:
        page = context.new_page()
        page.goto(BASE + "/encyclopedia/arcanum/4?lang=ru")
        expect(page.locator("html")).to_have_attribute("lang", "en")
        expect(page.locator("h1")).to_contain_text("4 in the destiny matrix: The Emperor")
        assert "lang=" not in page.url
        # Prefetching private navigation can persist the URL locale; the query/browser
        # preference must never persist Russian while the English URL is displayed.
        assert all(cookie["value"] == "en" for cookie in context.cookies()
                   if cookie["name"] == "arcana_locale")
        # A real interaction confirms hydration; automatic browser language never wins.
        page.get_by_test_id("language-ru").click()
        expect(page.locator("html")).to_have_attribute("lang", "ru")
        expect(page.locator("h1")).to_contain_text("Император")


def test_public_language_is_in_url_and_does_not_change_other_tabs(page):
    page.goto(BASE + "/en/encyclopedia/arcanum/4")
    page.get_by_test_id("language-ru").click()
    page.wait_for_url(BASE + "/ru/encyclopedia/arcanum/4")
    page.locator('header a[href="/ru/encyclopedia"]').click()
    expect(page.locator("h1")).to_contain_text("Энциклопедия")
    page.reload()
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    other = page.context.new_page()
    other.goto(BASE + "/en/encyclopedia/arcanum/4")
    expect(other.locator("html")).to_have_attribute("lang", "en")
    expect(page.locator("html")).to_have_attribute("lang", "ru")


def test_russian_domain_serves_russian_html_and_switches_to_english(browser):
    html, _ = read("/encyclopedia/arcanum/4", "localhost:3000", Cookie="arcana_locale=en")
    assert '<html lang="ru"' in html and "Император" in html
    with browser.new_context(locale="en-US") as context:
        page = context.new_page()
        page.goto("http://localhost:3000/encyclopedia/arcanum/4")
        expect(page.locator("h1")).to_contain_text("Император")
        page.get_by_test_id("language-en").click()
        expect(page.locator("html")).to_have_attribute("lang", "en")
        expect(page.locator("h1")).to_contain_text("The Emperor")


def test_unknown_host_is_rejected():
    with pytest.raises(urllib.error.HTTPError) as error:
        read("/", "unknown.example", **{"X-Forwarded-Host": "arcana-sense.com"})
    assert error.value.code == 421


@pytest.mark.parametrize("host,locale", [("arcana-sense.ru", "ru"), ("arcana-sense.com", "en")])
def test_encyclopedia_navigation_has_no_legacy_links(host, locale):
    """Includes the plain-anchor sidebar, not just Next Link cards."""
    html, _ = read("/encyclopedia", host)
    links = re.findall(r'<a\b[^>]*href="([^"]+)"', html)
    assert links
    assert f"/{locale}/encyclopedia/arcanum" in links
    assert not any(href.startswith("/encyclopedia") for href in links)
