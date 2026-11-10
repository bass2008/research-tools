"""Детско-родительская линия A–O–J и детская матрица: раздел разбора, точка O на схеме, статьи и заказ."""
from playwright.sync_api import expect

import flows
from conftest import BASE


def test_guest_sees_o_on_the_chart_and_a_locked_line(page):
    """12.08.1992: линия 12–7–22. У O на схеме роль в линии, раздел закрыт: карты и заглушка толкования."""
    flows.calculate(page, 12, 8, 1992, "f")
    expect(page.locator("svg title", has_text="Отношение к детям · физика Аджны · O: аркан 7").first).to_be_attached()
    section = page.get_by_test_id("section-parent_child_line")
    expect(section).to_have_attribute("data-locked", "true")
    preview = page.get_by_test_id("parent-child-line-preview")
    expect(preview.locator(".mpc")).to_have_count(3)
    expect(page.get_by_test_id("chakra-lock-parent_child_line")).to_contain_text("Откроется в полном разборе")


def test_buyer_reads_the_connected_reading_of_the_line(page, mail):
    """После покупки раздел открыт и стоит между «Отношениями» и «Родителями и детьми»."""
    flows.buy(page, mail, 12, 8, 1992, sex="f")
    flows.calculate(page, 12, 8, 1992, "f")
    keys = page.evaluate("() => [...document.querySelectorAll('[data-testid^=\"section-\"]')].map(e => e.dataset.testid.slice(8))")
    at = keys.index("parent_child_line")
    assert keys[at - 1:at + 2] == ["relations", "parent_child_line", "parents_children"], keys
    section = page.get_by_test_id("section-parent_child_line")
    expect(section).to_have_attribute("data-locked", "false")
    section.locator("summary").click()
    reading = page.get_by_test_id("parent-child-line-reading")
    expect(reading.locator("figure")).to_have_count(3)
    expect(reading.locator("figure").nth(1)).to_have_attribute("data-arcanum", "7")
    expect(reading.locator("h3")).not_to_be_empty()


def test_articles_lead_to_a_parent_and_child_order(page):
    """Статья линии и детская матрица открыты; кнопка пары ведёт в заказ с ролью «Родитель и ребёнок»."""
    page.goto(f"{BASE}/encyclopedia/position/parent_child_line", wait_until="domcontentloaded")
    expect(page.locator("h1")).to_have_count(1)
    expect(page.get_by_test_id("family-offer-line")).to_be_visible()
    page.goto(f"{BASE}/encyclopedia/child-matrix", wait_until="networkidle")
    expect(page.locator("h1")).to_have_count(1)
    offer = page.get_by_test_id("family-offer-child")
    expect(offer).to_be_visible()
    offer.get_by_test_id("family-offer-order-pair").click()
    page.wait_for_url("**/pay?pair=1&rel=parent_child#order")
    expect(page.locator("#order").get_by_role("button", name="Родитель и ребёнок")).to_have_attribute("aria-pressed", "true")
