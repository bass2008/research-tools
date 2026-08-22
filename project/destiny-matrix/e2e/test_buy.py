"""Покупка: что выбрал — то и оплатилось, что оплатил — то и открылось."""
from __future__ import annotations

from playwright.sync_api import expect

import flows
from conftest import BASE


def test_guest_sees_free_sections_and_locks(page):
    flows.calculate(page, 14, 3, 1993, "f")
    assert flows.open_sections(page) >= 1, "открытых разделов нет"
    assert flows.locked_sections(page) >= 10, "платные разделы не под замком"


def test_pay_button_shows_the_chosen_date(page):
    flows.calculate(page, 11, 8, 2004)
    flows.open_pay(page)
    assert flows.label(11, 8, 2004) in page.get_by_test_id("pay-submit").inner_text()


def test_new_calculation_replaces_the_target(page):
    """Регресс: посчитал одну дату, ушёл считать другую, вернулся к оплате — платить надо за вторую."""
    flows.calculate(page, 2, 3, 1993)
    flows.open_pay(page)
    assert flows.label(2, 3, 1993) in page.get_by_test_id("pay-submit").inner_text()

    page.click(".logo")
    page.wait_for_timeout(600)
    flows.calculate(page, 11, 8, 2004)
    flows.open_pay(page)
    assert flows.label(11, 8, 2004) in page.get_by_test_id("pay-submit").inner_text()


def test_purchase_with_new_email_opens_the_report(page, mail):
    flows.buy(page, mail, 20, 3, 1993)
    expect(page.get_by_test_id("paid-matrix")).to_contain_text("20 марта 1993")
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(1200)
    assert flows.locked_sections(page) == 0, "после покупки остались закрытые разделы"


def test_purchase_with_known_email_and_right_password(page, mail):
    flows.register(page, mail)
    page.get_by_test_id("logout").click()
    page.wait_for_timeout(600)
    flows.buy(page, mail, 21, 3, 1993)
    expect(page.get_by_test_id("signed-into")).to_contain_text(mail)


def test_purchase_with_known_email_and_wrong_password(page, mail):
    flows.register(page, mail, "1234")
    page.get_by_test_id("logout").click()
    page.wait_for_timeout(600)
    flows.buy(page, mail, 22, 3, 1993, password="9999")
    expect(page.locator(".err")).to_contain_text("пароль")
    assert page.get_by_test_id("paid-matrix").count() == 0, "платёж прошёл с чужим паролем"


def test_paying_the_same_date_twice_is_refused(page, mail):
    """Открытую дату второй раз не продаём: раньше кнопка платила и отказ приходил с сервера,
    теперь платить нечего — форма говорит это до нажатия."""
    flows.buy(page, mail, 23, 3, 1993)
    expect(page.get_by_test_id("paid-matrix")).to_be_visible()
    flows.calculate(page, 23, 3, 1993)
    flows.open_pay(page)
    page.wait_for_timeout(1200)
    expect(page.get_by_test_id("pay-open-note")).to_contain_text("уже открыт")
    assert page.get_by_test_id("pay-submit").is_disabled(), "открытую дату дают оплатить снова"


def test_second_date_opens_and_first_stays_open(page, mail):
    flows.buy(page, mail, 24, 3, 1993)
    first = page.get_by_test_id("paid-matrix").inner_text()
    flows.buy(page, mail, 25, 3, 1993)
    expect(page.get_by_test_id("paid-matrix")).to_contain_text("25 марта 1993")
    assert "24 марта" in first
    flows.account(page)
    cards = flows.matrix_cards(page)
    texts = [cards.nth(i).inner_text() for i in range(cards.count())]
    assert sum("куплена" in t.lower() for t in texts) == 2, texts
