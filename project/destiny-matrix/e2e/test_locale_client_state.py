"""Language changes update loaded data and messages without resubmitting forms."""
import re

import pytest
from playwright.sync_api import expect

import flows
from conftest import BASE
from test_runtime_localization import switch


@pytest.fixture(autouse=True)
def russian(page):
    page.context.add_cookies([{"name": "arcana_locale", "value": "ru", "url": BASE}])


@pytest.mark.usefixtures("multilingual_checkout")
def test_saved_payment_target_switches_without_losing_form(page, mail):
    registered = page.request.post(BASE + "/api/auth/register", data={"email": mail, "password": "123"})
    assert registered.ok, registered.text()
    created = page.request.post(BASE + "/api/matrices", data={"birth": "1993-03-31", "sex": "f"})
    assert created.ok, created.text()
    matrix_id = created.json()["id"]
    page.goto(BASE + f"/pay/single?m={matrix_id}")
    target = page.get_by_test_id("pay-target")
    submit = page.get_by_test_id("pay-submit")
    expect(target).to_have_value(str(matrix_id))
    expect(submit).to_have_text("Оплатить 250 ₽ · Матрица 31 марта 1993")
    consent = page.locator(".consent input")
    consent.check()
    page.evaluate("window.localeDocumentMarker = 'same-document'")
    switch(page, "en")
    expect(submit).to_have_text("Pay 250 ₽ · Chart of 31 March 1993")
    expect(target.locator("option:checked")).to_have_text("Chart of 31 March 1993 · account")
    expect(target).to_have_value(str(matrix_id))
    expect(consent).to_be_checked()
    expect(page.get_by_test_id("pay-email")).to_have_value(mail)
    assert page.evaluate("window.localeDocumentMarker") == "same-document"
    switch(page, "ru")
    expect(submit).to_have_text("Оплатить 250 ₽ · Матрица 31 марта 1993")

    renamed = page.request.patch(BASE + f"/api/matrices/{matrix_id}", data={"title": "Моя карта"})
    assert renamed.ok
    page.reload()
    expect(submit).to_contain_text("Моя карта")
    switch(page, "en")
    expect(submit).to_have_text("Pay 250 ₽ · Моя карта")


@pytest.mark.usefixtures("multilingual_checkout")
def test_calculator_payment_keeps_inputs_when_language_changes(page, mail):
    flows.calculate(page, 31, 3, 1993)
    flows.open_pay(page)
    page.get_by_test_id("pay-email").fill(mail)
    page.get_by_test_id("pay-password").fill("123")
    page.locator(".consent input").check()
    switch(page, "en")
    expect(page.get_by_test_id("pay-target")).to_have_value("local")
    expect(page.get_by_test_id("pay-submit")).to_have_text("Pay 250 ₽ · 31 March 1993")
    expect(page.get_by_test_id("pay-email")).to_have_value(mail)
    expect(page.get_by_test_id("pay-password")).to_have_value("123")
    expect(page.locator(".consent input")).to_be_checked()


@pytest.mark.parametrize("form", ["login", "register", "forgot", "reset", "pay", "calc"])
def test_validation_message_switches_without_resubmitting(page, form, request):
    if form == "pay":
        request.getfixturevalue("multilingual_checkout")
        flows.calculate(page, 31, 3, 1993)
        flows.open_pay(page)
        page.get_by_test_id("pay-email").fill("user@example.ru")
        page.get_by_test_id("pay-submit").click()
    elif form == "calc":
        page.goto(BASE + "/")
        expect(page.locator("html")).to_have_attribute("lang", "ru")
        page.locator("#d").select_option("31")
        page.locator("#m").select_option("2")
        page.get_by_test_id("calc-submit").click()
    else:
        page.goto(BASE + ("/reset?token=broken" if form == "reset" else f"/{form}"))
        if form == "register":
            page.get_by_test_id("auth-email").fill("user@example.ru")
            page.get_by_test_id("auth-password").fill("123")
        button = "auth-submit" if form in ("login", "register") else f"{form}-submit"
        page.get_by_test_id(button).click()
    error = page.locator(".err").first
    expect(error).to_be_visible()
    original = error.inner_text()
    assert re.search("[А-Яа-я]", original)
    switch(page, "en")
    expect(error).to_be_visible()
    expect(error).not_to_contain_text(re.compile("[А-Яа-я]"))
    switch(page, "ru")
    expect(error).to_have_text(original)


@pytest.mark.parametrize("form", ["login", "reset"])
def test_server_error_switches_without_repeating_post(page, mail, form):
    writes = []
    page.on("request", lambda req: writes.append(req.url)
            if req.method == "POST" and "/api/auth/" in req.url else None)
    page.goto(BASE + ("/login" if form == "login" else "/reset?token=broken"))
    if form == "login":
        page.get_by_test_id("auth-email").fill(mail)
        page.get_by_test_id("auth-password").fill("123")
        page.get_by_test_id("auth-submit").click()
        english = "Wrong email or password"
    else:
        page.get_by_test_id("reset-password").fill("123")
        page.get_by_test_id("reset-submit").click()
        english = "The link is invalid"
    error = page.locator(".err[role=alert]")
    expect(error).to_be_visible()
    original = error.inner_text()
    assert len(writes) == 1
    switch(page, "en")
    expect(error).to_have_text(english)
    switch(page, "ru")
    expect(error).to_have_text(original)
    assert len(writes) == 1
