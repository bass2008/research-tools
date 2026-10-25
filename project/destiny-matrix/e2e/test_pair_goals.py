"""Воронка совместимости: проверяем события локально, без запросов в боевую Метрику."""
import pytest
from playwright.sync_api import expect

from conftest import BASE
from test_pair import calc_pair


@pytest.mark.parametrize("selector,place,section", [
    ('[data-testid="pair-buy-characters"]', "pair-section", "characters"),
    ('[data-testid="pair-lock-characters"] > a.head', "pair-section", "characters"),
    ('[data-testid="pair-buy-chakras"]', "pair-section", "chakras"),
    ('[data-testid^="chakra-lock-"] > a', "pair-chakra", "chakras"),
    ('[data-testid="chakra-dialog"] a[href^="/pay"]', "pair-main", None),
])
def test_pair_purchase_links_emit_one_goal(page, selector, place, section):
    calc_pair(page)
    assert page.evaluate("window.dataLayer.filter(e => e.event === 'pair_calc')") == [{"event": "pair_calc"}]
    if place == "pair-main":
        page.get_by_test_id("pair-chakras").locator('[data-chakra-row="muladhara"]').click()
    # Keep the document to inspect its event; Next's click handler must still run.
    page.get_by_test_id("pair-report").evaluate("el => el.addEventListener('click', e => e.preventDefault(), true)")
    link = page.locator(selector).first
    expect(link).to_have_attribute("href", "/pay?for=pair")
    link.click()
    events = page.evaluate("window.dataLayer.filter(e => e.event === 'buy_click')")
    expected = {"event": "buy_click", "tariff": "pair", "place": place}
    if section:
        expected["section"] = section
    assert events == [expected]


@pytest.mark.parametrize("tariff", ["single", "pair", "month"])
def test_checkout_open_tracks_the_selected_tariff(page, tariff):
    page.goto(f"{BASE}/pay/{tariff}")
    expect(page.get_by_test_id("pay-submit")).to_be_visible()
    page.wait_for_function("window.dataLayer?.some(e => e.event === 'pay_open')")
    assert page.evaluate("window.dataLayer.filter(e => e.event === 'pay_open')") == [
        {"event": "pay_open", "tariff": tariff},
    ]


def test_checkout_tariff_change_tracks_the_actual_choice(page):
    page.goto(f"{BASE}/pay?for=pair")
    page.get_by_test_id("plan-month").click()
    expect(page.get_by_test_id("pay-submit")).to_be_visible()
    assert page.evaluate("window.dataLayer.filter(e => e.event === 'tariff_select')") == [
        {"event": "tariff_select", "tariff": "month", "place": "buy"},
    ]
