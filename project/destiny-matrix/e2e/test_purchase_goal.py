"""Цель покупки после возврата из банка; ответы эквайринга подменены, списаний нет."""
import pytest
from playwright.sync_api import expect

from conftest import BASE


def _bank_result(page, *, state="paid", paid=True, status="CONFIRMED", payment_id="bank-123"):
    # Реальный счётчик не вызываем; проверяем также существующий dataLayer.
    page.add_init_script("window.__ym = []; window.ym = (...args) => window.__ym.push(args);")
    page.route("**/api/payments/sync", lambda route: route.fulfill(json={
        "ok": True, "status": status, "state": state, "paid": paid,
        "payment_id": payment_id, "matrix_id": 42, "product": "personal",
    }))


def _purchases(page):
    return page.evaluate("(window.dataLayer || []).filter(event => event.event === 'purchase')")


def test_bank_return_tracks_purchase_once_even_after_reload(page):
    _bank_result(page)
    page.goto(f"{BASE}/pay/done?order=bank-order-123&lang=ru")
    expect(page.locator("main h1")).to_have_text("Доступ открыт")
    assert len(_purchases(page)) == 1, "Банк подтвердил оплату, но цель purchase не отправлена"
    counter = int(page.locator("html").get_attribute("data-metrika-id") or 0)
    if counter:
        calls = page.evaluate("window.__ym.filter(call => call[1] === 'reachGoal' && call[2] === 'purchase')")
        assert len(calls) == 1
        assert calls[0][0] == counter

    page.reload()
    expect(page.locator("main h1")).to_have_text("Доступ открыт")
    assert _purchases(page) == [], "Обновление чека повторно засчитало ту же покупку"

    # Дедупликация по платежу, а не глобальный запрет последующих покупок.
    page.unroute("**/api/payments/sync")
    _bank_result(page, payment_id="bank-456")
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


def test_bank_return_does_not_track_without_server_confirmation(page):
    page.route("**/api/payments/sync", lambda route: route.fulfill(
        status=401, json={"detail": "Войдите в аккаунт"}))
    page.goto(f"{BASE}/pay/done?order=bank-order-123&lang=ru")
    expect(page.locator("main h1")).to_have_text("Войдите, чтобы проверить оплату и открыть разбор")
    expect(page).to_have_title("Войдите для проверки оплаты — Arcana Sense")
    expect(page.locator("main")).not_to_contain_text("Платёж ещё обрабатывается")
    assert _purchases(page) == []


def test_bank_return_waits_for_payment_before_tracking(page):
    confirmed = False

    def sync(route):
        route.fulfill(json={
            "ok": True, "status": "CONFIRMED" if confirmed else "NEW",
            "state": "paid" if confirmed else "new", "paid": confirmed,
            "payment_id": "bank-delayed", "matrix_id": 42, "product": "personal",
        })

    page.route("**/api/payments/sync", sync)
    with page.expect_response("**/api/payments/sync"):
        page.goto(f"{BASE}/pay/done?order=bank-delayed&lang=ru")
    assert _purchases(page) == [], "Возврат из банка сам по себе ещё не подтверждает покупку"
    confirmed = True
    expect(page.locator("main h1")).to_have_text("Доступ открыт")
    assert len(_purchases(page)) == 1
