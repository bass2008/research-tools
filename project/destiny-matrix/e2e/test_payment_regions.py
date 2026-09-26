"""Локальная приёмка разделения платёжных провайдеров по доменам."""
import os
from pathlib import Path
from urllib.parse import urlsplit

import pytest
from playwright.sync_api import expect

from conftest import BASE, REMOTE
from test_runtime_localization import switch

COM = os.environ.get("E2E_INTERNATIONAL_URL", "http://127.0.0.1:3000")
RU = os.environ.get("E2E_RUSSIAN_URL", "http://localhost:3000")
EN_MESSAGE = "There are currently no payment methods available for your region"
RU_MESSAGE = "На данный момент нет доступной оплаты для вашего региона"
ARTIFACTS = Path(os.environ.get("PAYMENT_REGION_ARTIFACTS", "/tmp/arcana-payment-regions"))
pytestmark = pytest.mark.skipif(REMOTE, reason="Этот сценарий проверяет локальный mock, без живого банка")


@pytest.mark.parametrize("width", [1360, 390])
def test_unavailable_payment_switches_without_opening_checkout(page, width):
    page.set_viewport_size({"width": width, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(COM + "/pay/single")
    expect(page.locator("main")).to_contain_text(EN_MESSAGE)
    expect(page.get_by_test_id("pay-modal")).to_have_count(0)
    page.evaluate("window.paymentDocument = 'same'")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(ARTIFACTS / f"com-en-{width}.png"), full_page=True)
    switch(page, "ru")
    expect(page.locator("main")).to_contain_text(RU_MESSAGE)
    expect(page.get_by_test_id("pay-modal")).to_have_count(0)
    assert page.evaluate("window.paymentDocument") == "same"
    page.screenshot(path=str(ARTIFACTS / f"com-ru-{width}.png"), full_page=True)
    page.reload()
    expect(page.locator("main")).to_contain_text(RU_MESSAGE)
    switch(page, "en")
    expect(page.locator("main")).to_contain_text(EN_MESSAGE)
    assert errors == []


def test_com_does_not_accept_spoofed_context_or_provider(page, mail):
    for path, provider in (("start", "tbank"), ("start", "mock"), ("mock", "mock")):
        response = page.request.post(COM + "/api/payments/" + path,
            headers={"Accept-Language": "ru", "X-Arcana-Site-Origin": RU,
                     "X-Forwarded-Host": urlsplit(RU).netloc},
            data={"tariff": "single", "email": mail, "birth": "1993-03-31", "provider": provider})
        assert response.status == 403, response.text()
        assert response.json()["detail"] == RU_MESSAGE
    assert page.request.get(COM + "/api/tariffs").json()["payment_providers"] == []


def test_ru_checkout_and_shared_purchase_on_com(page, mail):
    # Known password on COM; RU payment grants the same account's rights.
    assert page.request.post(COM + "/api/auth/register", data={"email": mail, "password": "123"}).ok
    page.goto(RU + "/pay/single")
    expect(page.get_by_test_id("pay-modal")).to_be_visible()
    expect(page.get_by_test_id("language-en")).to_have_count(0)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(ARTIFACTS / "ru-checkout.png"), full_page=True)
    response = page.request.post(RU + "/api/payments/start", data={
        "tariff": "single", "email": mail, "birth": "1993-03-31", "sex": "f", "provider": "mock"})
    assert response.ok, response.text()
    bought = response.json()
    assert bought["paid"] and bought["provider"] == "mock"
    me = page.request.get(COM + "/api/auth/me").json()
    assert me["owned"] == 1
    page.goto(COM + f"/report?m={bought['matrix_id']}")
    expect(page.locator("html")).to_have_attribute("lang", "en")
    expect(page.locator("[data-locked=true]")).to_have_count(0)
    switch(page, "ru")
    expect(page.locator("[data-locked=true]")).to_have_count(0)


def test_terms_distinguish_free_calculator_from_account_readings(page):
    page.goto(COM + "/terms")
    expect(page.locator("main")).to_contain_text("An account is required to save charts and access purchased readings")
    expect(page.locator("main")).not_to_contain_text("An account is optional")
    switch(page, "ru")
    expect(page.locator("main")).to_contain_text("Для сохранения карт и доступа к приобретённым разборам нужен аккаунт")
    expect(page.locator("main")).not_to_contain_text("Аккаунт необязателен")
