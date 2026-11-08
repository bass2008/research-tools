"""Индивидуальный разбор заказывают на лендинге: набор, люди каждого разбора и оплата —
всё до оплаты (docs/individual-reading.md, раздел «Заказ»)."""
import re

from playwright.sync_api import expect

from conftest import BASE


def test_couple_set_is_ordered_from_the_landing(page, mail):
    """Своя дата из блока связей встаёт в форму, у пары свои люди, заказ оплачивается;
    после трёх разборов наборы стоят по личной цене, обычная зачёркнута."""
    page.goto(f"{BASE}/individual", wait_until="networkidle")
    page.locator("#lm-bd").fill("05031990")
    page.locator(".lm-dform button").click()
    expect(page.locator(".lm-map-cap")).to_contain_text("05.03.1990")

    page.get_by_test_id("iset-couple").locator("a.lp-btn").click()
    expect(page.locator("fieldset.lp-person")).to_have_count(3)
    expect(page.locator("#lp-p0-y")).to_have_value("1990")
    page.locator("#lp-p1-y").select_option("1988")
    expect(page.get_by_test_id("iorder-dates")).to_contain_text("1988")

    page.get_by_test_id("iorder-email").fill(mail)
    page.get_by_test_id("iorder-password").fill("1234")
    page.get_by_test_id("iorder-consent").check()
    expect(page.get_by_test_id("iorder-submit")).to_contain_text("3 590")
    page.get_by_test_id("iorder-submit").click()
    expect(page.get_by_test_id("iorder-done")).to_be_visible()

    # each ordered reading waits in the cabinet as "in progress", with the cards of its own dates
    page.goto(f"{BASE}/account", wait_until="networkidle")
    cards = page.get_by_test_id("individual-card")
    expect(cards).to_have_count(3)
    for card in cards.all():
        expect(card).to_have_attribute("data-status", "in-progress")
        expect(card.get_by_test_id("work-badge")).to_have_text("В работе")
        expect(card.locator(".afan img")).to_have_count(3)

    for path, price in (("/pay", ".pw-iprice"), ("/individual", ".lp-price")):
        page.goto(f"{BASE}{path}", wait_until="networkidle")
        expect(page.get_by_test_id("isale-perk")).to_be_visible()
        expect(page.get_by_test_id("iset-selfYear").locator(price)).to_have_text(re.compile(r"2\s380\s₽\s*2\s990\s₽"))
        expect(page.get_by_test_id("iset-selfYear").locator(f"{price} s")).to_have_text(re.compile(r"2\s990\s₽"))


def test_a_set_from_the_pay_page_opens_the_form_in_place(page):
    """Конструктор на странице оплаты открывает форму заказа тут же, с тем же набором."""
    page.goto(f"{BASE}/pay", wait_until="networkidle")
    expect(page.locator("#order")).to_have_count(0)
    page.get_by_test_id("ibuilder").locator("a.pw-ibtn").click()
    expect(page.locator('input[name="lp-set"][value="custom"]')).to_be_checked()
    expect(page.locator("fieldset.lp-person")).to_have_count(2)
    assert "/individual" not in page.url


def test_the_year_widget_orders_on_the_pay_page_with_its_date(page):
    """«Заказать» в виджете года ведёт на «Купить»: разбор выбранного года и введённая дата уже в форме."""
    page.goto(f"{BASE}/year/7", wait_until="networkidle")
    widget = page.get_by_test_id("year-individual-offer")
    widget.locator("#year-links-bd").fill("24.05.1981")
    widget.locator(".lm-dform button.lm-btn-gold").click()
    expect(widget.locator(".lm-map-cap")).to_contain_text("24.05.1981")
    year = widget.locator(".yb-years button[aria-pressed=true]").inner_text()
    widget.get_by_test_id("year-offer-order").first.click()
    page.wait_for_url(f"**/pay?year=1&y={year}*")
    expect(page.locator('input[name="lp-set"][value="one"]')).to_be_checked()
    expect(page.locator(".lp-summary-card h3")).to_contain_text("год")
    expect(page.locator("#lp-y0-y")).to_have_value("1981")


def test_the_year_widget_follows_the_picked_year(page):
    """Другой год в виджете — другая матрица года: подпись схемы, кнопка показа и заказ этого года."""
    page.goto(f"{BASE}/year", wait_until="networkidle")
    widget = page.get_by_test_id("year-individual-offer")
    widget.locator("#year-links-bd").fill("17.09.1986")
    widget.locator("#year-links-bd").press("Enter")
    expect(widget.locator(".lm-map-cap")).to_contain_text("17.09.1986")
    other = widget.locator(".yb-years button[aria-pressed=false]")
    year = other.inner_text()
    other.click()
    expect(widget.locator(".lm-map-cap")).to_contain_text(f"17.09.1986 → {year}")
    expect(widget.locator(".lm-dform button.lm-btn-gold")).to_contain_text(year)
    expect(widget.get_by_test_id("year-offer-order").first).to_contain_text(year)
    expect(widget.get_by_test_id("year-offer-order").first).to_have_attribute("href", re.compile(rf"y={year}"))
