"""Связи под разбором: личная схема под отчётом и схема пары под совместимостью — одна связь открыта,
остальные ведут в индивидуальный разбор, заказ приходит с датами."""
import re

from playwright.sync_api import Page, expect

import flows
from test_pair import calc_pair


def lines_drawn(page: Page, offer: str) -> None:
    page.get_by_test_id(offer).scroll_into_view_if_needed()
    page.wait_for_function("""id => {
      const routes = [...document.querySelectorAll(`[data-testid=${id}] .lm-oct:not(.lm-m) .lm-route`)];
      return routes.length > 0 && routes.every(p => getComputedStyle(p).strokeDashoffset === "0px");
    }""", arg=offer, timeout=10_000)


def header_bottom(page: Page) -> float:
    return page.evaluate("Math.max(0, ...[...document.querySelectorAll('.site-header')].map(h => h.getBoundingClientRect().bottom))")


def test_report_shows_the_links_of_this_date_and_one_is_open(page: Page):
    flows.calculate(page, 31, 3, 1993)
    offer = page.get_by_test_id("report-individual-offer")
    expect(offer).to_contain_text("31.03.1993")
    lines_drawn(page, "report-individual-offer")
    expect(offer.locator(".lm-oct:not(.lm-m) .lm-age")).to_have_count(7)
    offer.get_by_test_id("links-more").click()
    links = offer.locator(".lm-st")
    assert links.count() >= 2
    expect(links.first.locator(".lm-free")).to_be_visible()
    expect(links.first.locator(".lm-rule")).to_contain_text("Лисовская советует сложить")
    expect(offer.locator(".lm-free")).to_have_count(1)
    assert offer.get_by_test_id("report-offer-order").first.get_attribute("href").endswith("/pay?personal=1#order")


def test_opening_the_next_link_brings_it_to_the_top(page: Page):
    flows.calculate(page, 31, 3, 1993)
    offer = page.get_by_test_id("report-individual-offer")
    offer.get_by_test_id("links-more").click()
    links = offer.locator(".lm-st")
    links.first.locator(".lm-st-body").evaluate("e => e.scrollIntoView({block: 'end', behavior: 'instant'})")
    links.nth(1).locator(".lm-st-head").click()
    page.wait_for_timeout(200)
    top = links.nth(1).evaluate("e => e.getBoundingClientRect().top")
    assert abs(top - header_bottom(page) - 12) <= 2, top


def test_couple_sees_the_links_of_their_matrix_and_orders_with_both_dates(page: Page):
    calc_pair(page)
    offer = page.get_by_test_id("pair-individual-offer")
    expect(offer).to_contain_text("Индивидуальный разбор пары")
    expect(offer).to_contain_text("31.03.1993 + 28.12.1994")
    lines_drawn(page, "pair-individual-offer")
    # the couple has no age scale; the person's chart keeps it
    expect(offer.locator(".lm-oct:not(.lm-m) .lm-age")).to_have_count(0)
    expect(offer.locator(".lm-oct:not(.lm-m) .lm-tick")).to_have_count(0)
    count = int(re.search(r"\d+", offer.get_by_test_id("links-more").inner_text()).group())
    offer.get_by_test_id("links-more").click()
    links = offer.locator(".lm-st")
    expect(links).to_have_count(count)
    expect(offer.locator(".lm-count")).to_contain_text("в матрице вашей пары")
    rule = links.first.locator(".lm-rule")
    expect(rule).to_contain_text("Лисовская советует сложить")
    expect(rule).to_contain_text("Сергей —")
    expect(rule).to_contain_text("Виктория —")
    expect(rule).to_contain_text("«Матрица судьбы. Совместимость»")
    expect(links.nth(1).locator(".lm-lockp")).to_contain_text("в разборе пары")

    offer.get_by_test_id("pair-offer-order").first.click()
    page.wait_for_url(re.compile(r"/pay\?pair=1"))
    for field, value in (("a0-d", "31"), ("a0-m", "3"), ("a0-y", "1993"), ("b0-d", "28"), ("b0-m", "12"), ("b0-y", "1994")):
        expect(page.locator(f"#lp-{field}")).to_have_value(value)


def goals(page: Page, name: str) -> list[dict]:
    return page.evaluate("name => (window.dataLayer || []).filter(e => e.event === name).map(({ event, ...rest }) => rest)", name)


def test_links_blocks_report_their_funnel_to_metrika(page: Page):
    for open_block, offer_id, place in (
        (lambda: flows.calculate(page, 31, 3, 1993), "report-individual-offer", "report"),
        (lambda: calc_pair(page), "pair-individual-offer", "pair"),
    ):
        open_block()
        offer = page.get_by_test_id(offer_id)
        lines_drawn(page, offer_id)
        offer.get_by_test_id("links-more").click()
        offer.get_by_test_id("links-more").click()
        offer.get_by_test_id("links-more").click()
        assert goals(page, "individual_report_more") == [{"place": place}, {"place": place}]
        offer.evaluate("el => el.addEventListener('click', e => e.preventDefault(), true)")
        offer.get_by_test_id(f"{place}-offer-order").first.click()
        assert goals(page, "individual_report_order") == [{"place": place}]
