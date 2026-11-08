"""Материальная карма C–Q–L: точка Q на схеме, раздел перед «Деньгами», статьи энциклопедии."""
from playwright.sync_api import expect

import flows
from conftest import BASE


def test_guest_sees_q_on_the_chart_and_a_locked_reading(page):
    """12.08.1992: тройка 21–7–4. Q стоит на схеме, раздел закрыт: карты и заглушка толкования."""
    flows.calculate(page, 12, 8, 1992, "f")
    expect(page.locator("svg title", has_text="Отношение к материальному · Q: аркан 7").first).to_be_attached()
    section = page.get_by_test_id("section-material_karma")
    expect(section).to_have_attribute("data-locked", "true")
    preview = page.get_by_test_id("material-karma-preview")
    expect(preview.locator(".mpc")).to_have_count(3)
    expect(page.get_by_test_id("chakra-lock-material_karma")).to_contain_text("Откроется в полном разборе")
    expect(preview).not_to_contain_text("Большому замыслу")


def test_buyer_reads_the_connected_reading_of_the_three(page, mail):
    """После покупки раздел открыт: пояснения трёх точек и связное толкование своей тройки."""
    flows.buy(page, mail, 12, 8, 1992, sex="f")
    flows.calculate(page, 12, 8, 1992, "f")
    section = page.get_by_test_id("section-material_karma")
    expect(section).to_have_attribute("data-locked", "false")
    section.locator("summary").click()
    expect(section.locator(".postext")).to_have_count(3)
    reading = page.get_by_test_id("material-karma-reading")
    expect(reading.locator("figure")).to_have_count(3)
    expect(reading.locator("figure").nth(1)).to_have_attribute("data-arcanum", "7")
    expect(reading.locator("h3")).not_to_be_empty()


def test_encyclopedia_explains_the_line_and_the_month(page):
    """Статья раздела берёт полные толкования из корпуса; статья о месяце связана с годом."""
    page.goto(f"{BASE}/encyclopedia/position/material_karma", wait_until="domcontentloaded")
    expect(page.locator("h1")).to_have_text("Материальная карма в матрице судьбы")
    expect(page.locator("[data-chakra=material_karma]")).to_have_count(2)
    page.goto(f"{BASE}/year", wait_until="domcontentloaded")
    page.locator("a[href$='/encyclopedia/month']").first.click()
    expect(page.locator("h1")).to_contain_text("Аркан на месяц")
