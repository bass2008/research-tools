"""Индивидуальный разбор заказывают на лендинге: набор, люди каждого разбора и оплата —
всё до оплаты (docs/individual-reading.md, раздел «Заказ»)."""
from playwright.sync_api import expect

from conftest import BASE


def test_couple_set_is_ordered_from_the_landing(page, mail):
    """Своя дата из блока связей встаёт в форму, у пары свои люди, заказ оплачивается."""
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
    widget = page.get_by_test_id("year-reading-banner")
    widget.locator("input").press_sequentially("07101988")
    widget.locator(".yb-row button").click()
    widget.locator(".yb-btn").click()
    page.wait_for_url("**/pay?year=1&y=*")
    expect(page.locator('input[name="lp-set"][value="one"]')).to_be_checked()
    expect(page.locator(".lp-summary-card h3")).to_contain_text("год")
    expect(page.locator("#lp-y0-y")).to_have_value("1988")
