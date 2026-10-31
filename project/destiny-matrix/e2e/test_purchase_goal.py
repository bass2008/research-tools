"""Цель покупки после возврата из банка; ответы эквайринга подменены, списаний нет."""
import pytest
from playwright.sync_api import expect

from conftest import BASE


def _bank_result(page, *, state="paid", paid=True, status="CONFIRMED", payment_id="bank-123", tariff="single"):
    # Реальный счётчик не вызываем; проверяем также существующий dataLayer.
    page.add_init_script("window.__ym = []; window.ym = (...args) => window.__ym.push(args);")
    page.route("**/api/payments/sync", lambda route: route.fulfill(json={
        "ok": True, "status": status, "state": state, "paid": paid,
        "payment_id": payment_id, "matrix_id": None if tariff == "month" else 42,
        "product": "pair" if tariff == "pair" else "personal",
        "tariff": tariff, "subscription": tariff == "month",
    }))


def _purchases(page):
    return page.evaluate("(window.dataLayer || []).filter(event => event.event === 'purchase')")


@pytest.mark.parametrize("tariff", ["single", "pair", "month"])
def test_bank_return_tracks_purchase_once_even_after_reload(page, tariff):
    _bank_result(page, tariff=tariff)
    page.goto(f"{BASE}/pay/done?order=bank-order-123&lang=ru")
    expect(page.locator("main h1")).to_have_text("Доступ открыт")
    assert _purchases(page) == [{"event": "purchase", "tariff": tariff}], "Оплата должна передавать купленный тариф"
    counter = int(page.locator("html").get_attribute("data-metrika-id") or 0)
    if counter:
        calls = page.evaluate("window.__ym.filter(call => call[1] === 'reachGoal' && call[2] === 'purchase')")
        assert len(calls) == 1
        assert calls[0][0] == counter
        assert calls[0][3] == {"tariff": tariff}

    page.reload()
    expect(page.locator("main h1")).to_have_text("Доступ открыт")
    assert _purchases(page) == [], "Обновление чека повторно засчитало ту же покупку"

    # Дедупликация по платежу, а не глобальный запрет последующих покупок.
    page.unroute("**/api/payments/sync")
    _bank_result(page, payment_id="bank-456", tariff=tariff)
    page.goto(f"{BASE}/pay/done?order=bank-order-456&lang=ru")
    expect(page.locator("main h1")).to_have_text("Доступ открыт")
    assert len(_purchases(page)) == 1


@pytest.mark.parametrize("state,paid,title", [
    ("failed", False, "Платёж не прошёл"),
    ("abandoned", False, "Платёж не прошёл"),
    # paid_at остаётся заполненным даже после возврата.
    ("refunded", True, "Платёж возвращён"),
])
def test_bank_return_does_not_track_unsuccessful_purchase(page, state, paid, title):
    _bank_result(page, state=state, paid=paid)
    page.goto(f"{BASE}/pay/done?order=bank-order-123&lang=ru")
    expect(page.locator("main h1")).to_have_text(title)
    assert _purchases(page) == []


def _app_window_receipt(page, *, state="paid", paid=True, tariff="month"):
    # окно приложения банка: куки сайта нет, исход приходит по номеру заказа
    page.add_init_script("window.__ym = []; window.ym = (...args) => window.__ym.push(args);")
    page.route("**/api/payments/sync", lambda route: route.fulfill(
        status=401, json={"detail": "Войдите в аккаунт"}))
    page.route("**/api/payments/receipt", lambda route: route.fulfill(json={
        "ok": True, "status": "CONFIRMED" if paid else "NEW", "state": state, "paid": paid,
        "payment_id": "bank-app-1", "tariff": tariff, "subscription": tariff == "month",
        "until": "2027-01-28T12:29:10+00:00" if tariff == "month" else None,
    }))


def test_bank_app_window_shows_paid_order_without_session(page):
    _app_window_receipt(page)
    page.goto(f"{BASE}/pay/done?order=bank-order-123&lang=ru")
    expect(page.locator("main h1")).to_have_text("Доступ открыт")
    expect(page).to_have_title("Оплата прошла — Arcana Sense")
    expect(page.locator("main")).to_contain_text("подписка действует до")
    expect(page.get_by_role("link", name="Войти и открыть")).to_have_attribute(
        "href", "/ru/login?order=bank-order-123")
    assert _purchases(page) == [{"event": "purchase", "tariff": "month"}]


def test_bank_app_window_does_not_track_unconfirmed_order(page):
    _app_window_receipt(page, state="new", paid=False)
    page.goto(f"{BASE}/pay/done?order=bank-order-123&lang=ru")
    expect(page.locator("main h1")).to_have_text("Платёж ещё обрабатывается", timeout=20_000)
    assert _purchases(page) == []


def test_bank_return_waits_for_payment_before_tracking(page):
    confirmed = False

    def sync(route):
        route.fulfill(json={
            "ok": True, "status": "CONFIRMED" if confirmed else "NEW",
            "state": "paid" if confirmed else "new", "paid": confirmed,
            "payment_id": "bank-delayed", "matrix_id": 42, "product": "personal", "tariff": "single",
        })

    page.route("**/api/payments/sync", sync)
    with page.expect_response("**/api/payments/sync"):
        page.goto(f"{BASE}/pay/done?order=bank-delayed&lang=ru")
    assert _purchases(page) == [], "Возврат из банка сам по себе ещё не подтверждает покупку"
    confirmed = True
    expect(page.locator("main h1")).to_have_text("Доступ открыт")
    assert len(_purchases(page)) == 1
