"""One application switches language while keeping its state and account."""
from __future__ import annotations

import os
import re
import subprocess

import pytest
from playwright.sync_api import expect

from conftest import BASE


@pytest.fixture(autouse=True)
def explicit_russian_preference(page):
    page.context.add_cookies([{ "name": "arcana_locale", "value": "ru", "url": BASE }])


def switch(page, locale):
    page.get_by_test_id(f"language-{locale}").click()
    expect(page.locator("html")).to_have_attribute("lang", locale)
    expect(page.get_by_test_id(f"language-{'ru' if locale == 'en' else 'en'}")).to_be_enabled()


@pytest.mark.parametrize("width", [1360, 390])
def test_switch_preserves_form_and_document(page, width):
    page.set_viewport_size({"width": width, "height": 844})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "/")
    page.locator("#d").select_option("31")
    page.locator("#m").select_option("3")
    page.locator("#y").select_option("1993")
    page.evaluate("window.localeDocumentMarker = 'same-document'")
    switch(page, "en")
    expect(page.locator("#d")).to_have_value("31")
    expect(page.locator("#m")).to_have_value("3")
    expect(page.locator("#y")).to_have_value("1993")
    expect(page.locator("#m option:checked")).to_have_text("March")
    assert page.evaluate("window.localeDocumentMarker") == "same-document"
    assert page.url == BASE + "/"
    switch(page, "ru")
    expect(page.locator("#m option:checked")).to_have_text("Март")
    page.reload()
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    assert errors == []


def test_private_language_link_overrides_cookie_and_survives_switch(page):
    page.goto(BASE + "/login?lang=en#content")
    expect(page.locator("html")).to_have_attribute("lang", "en")
    page.evaluate("window.localeDocumentMarker = 'same-document'")
    switch(page, "ru")
    assert "lang=ru" in page.url and page.url.endswith("#content")
    assert page.evaluate("window.localeDocumentMarker") == "same-document"
    page.reload()
    expect(page.locator("html")).to_have_attribute("lang", "ru")


def test_article_switches_on_its_current_url(page):
    page.goto(BASE + "/encyclopedia/arcanum/4")
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    ru = page.locator("h1").inner_text()
    assert re.search("[А-Яа-я]", ru)
    switch(page, "en")
    en = page.locator("h1").inner_text()
    assert en != ru and not re.search("[А-Яа-я]", en)
    assert page.url == BASE + "/encyclopedia/arcanum/4"
    page.reload()
    expect(page.locator("html")).to_have_attribute("lang", "en")
    expect(page.locator("h1")).to_have_text(en)
    switch(page, "ru")
    expect(page.locator("h1")).to_have_text(ru)


def test_registration_and_both_domains_share_one_account(page, browser, mail):
    page.goto(BASE + "/register")
    page.get_by_test_id("auth-email").fill(mail)
    page.get_by_test_id("auth-password").fill("local-password-123")
    switch(page, "en")
    expect(page.get_by_test_id("auth-email")).to_have_value(mail)
    expect(page.get_by_test_id("auth-password")).to_have_value("local-password-123")
    page.locator("input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    page.wait_for_url("**/account")
    before = page.request.get(BASE + "/api/auth/me").json()
    created = page.request.post(BASE + "/api/matrices", data={"birth": "1993-03-31", "sex": "f"})
    assert created.ok, created.text()
    page.reload()
    expect(page.locator("main")).to_contain_text("31 March 1993")
    switch(page, "ru")
    expect(page.locator("main")).to_contain_text("31 марта 1993")
    after = page.request.get(BASE + "/api/auth/me").json()
    assert before["user"]["id"] == after["user"]["id"]

    other = os.environ.get("E2E_RUSSIAN_URL", "http://localhost:3000")
    with browser.new_context(locale="en-US") as context:
        second = context.new_page()
        second.goto(other + "/login")
        second.get_by_test_id("auth-email").fill(mail)
        second.get_by_test_id("auth-password").fill("local-password-123")
        second.get_by_test_id("auth-submit").click()
        second.wait_for_url("**/account")
        me = second.request.get(other + "/api/auth/me").json()
        assert me["user"]["id"] == before["user"]["id"]
        rows = second.request.get(other + "/api/matrices").json()["items"]
        assert rows[0]["id"] == created.json()["id"]
        expect(second.locator("main")).to_contain_text("31 марта 1993")
        expect(second.get_by_test_id("language-en")).to_have_count(0)


def test_paid_pdf_is_rendered_and_cached_per_locale(page, mail, tmp_path):
    page.goto(BASE + "/")
    registered = page.request.post(BASE + "/api/auth/register", data={"email": mail, "password": "123"})
    assert registered.ok, registered.text()
    russian = os.environ.get("E2E_RUSSIAN_URL", "http://localhost:3000")
    paid = page.request.post(russian + "/api/payments/mock", data={
        "email": mail, "tariff": "single", "birth": "1993-03-31", "sex": "f",
    })
    assert paid.ok, paid.text()
    matrix_id = paid.json()["matrix_id"]
    page.goto(BASE + f"/report?m={matrix_id}")
    switch(page, "en")
    en = page.request.post(BASE + "/api/reports/pdf", data={"matrix_id": matrix_id},
                           headers={"Accept-Language": "en"}, timeout=180_000)
    assert en.ok, en.text()
    pdf = page.request.get(en.json()["url"])
    assert pdf.ok and pdf.body().startswith(b"%PDF")
    file = tmp_path / "english.pdf"
    file.write_bytes(pdf.body())
    text = subprocess.run(["pdftotext", str(file), "-"], capture_output=True, text=True, check=True).stdout
    assert "March" in text, text[:500]
    assert "марта" not in text

    switch(page, "ru")
    ru = page.request.post(BASE + "/api/reports/pdf", data={"matrix_id": matrix_id},
                           headers={"Accept-Language": "ru"}, timeout=180_000)
    assert ru.ok, ru.text()
    assert ru.json()["job_id"] != en.json()["job_id"]
    again = page.request.post(BASE + "/api/reports/pdf", data={"matrix_id": matrix_id},
                              headers={"Accept-Language": "en"}, timeout=180_000)
    assert again.ok and again.json()["cached"]
    assert again.json()["job_id"] == en.json()["job_id"]
