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


def test_purchased_sex_is_the_one_shown(page, mail):
    """Дефект цикла 16: куплена мужская карта, человек выбирает «Женский» — открывается купленная
    мужская, а переключатель остаётся на «Женский». Экран утверждал сразу и то, и другое.

    Пол не меняет в разборе ни одного числа (engine/tests/test_method_contract.py), поэтому
    открывается купленная запись — но подписана она обязана быть своим полом, и переключатель
    обязан показывать его же."""
    flows.buy(page, mail, 9, 2, 1985, sex="m")
    expect(page.get_by_test_id("paid-matrix")).to_contain_text("9 февраля 1985")

    flows.calculate(page, 9, 2, 1985, "f")
    page.wait_for_timeout(1500)

    assert page.get_by_test_id("sex-m").get_attribute("aria-pressed") == "true", \
        "переключатель не показывает пол купленной карты"
    assert page.get_by_test_id("sex-f").get_attribute("aria-pressed") == "false"
    body = page.inner_text("body")
    assert "мужская карта" in body, "подпись карты не совпала с купленной записью"
    assert "женская карта" not in body, "на экране одновременно два пола"


def test_sex_of_a_date_nobody_bought_stays_as_chosen(page, mail):
    """Обратная сторона: пока дата не куплена, выбранный пол ничем не подменяется.

    Подпись «мужская/женская карта» печатается только у купленного разбора, поэтому здесь
    проверяется сам переключатель — он и есть то, что человек видит на бесплатной выкладке."""
    flows.register(page, mail)
    flows.calculate(page, 12, 6, 1992, "f")
    page.wait_for_timeout(1200)
    assert page.get_by_test_id("sex-f").get_attribute("aria-pressed") == "true"
    assert page.get_by_test_id("sex-m").get_attribute("aria-pressed") == "false"

    flows.calculate(page, 12, 6, 1992, "m")
    page.wait_for_timeout(1200)
    assert page.get_by_test_id("sex-m").get_attribute("aria-pressed") == "true"
    assert page.get_by_test_id("sex-f").get_attribute("aria-pressed") == "false"


def test_buy_offers_what_the_page_is_about(page):
    """«Купить» без выбора — все три предложения; со страницы разбора даты — эта дата или подписка,
    и дата встаёт в форму; с совместимости — эта пара или подписка."""
    page.goto(f"{BASE}/encyclopedia", wait_until="domcontentloaded")
    page.get_by_test_id("buy-top").click()
    expect(page.locator(".plan")).to_have_count(3)

    flows.calculate(page, 7, 5, 1971, "m")
    page.get_by_test_id("buy-top").click()
    expect(page.locator(".plan")).to_have_count(2)
    expect(page.get_by_test_id("plan-pair")).to_have_count(0)
    page.get_by_test_id("plan-single").click()
    expect(page.get_by_test_id("pay-submit")).to_contain_text(flows.label(7, 5, 1971))

    from test_pair import calc_pair
    calc_pair(page)
    page.get_by_test_id("buy-top").click()
    expect(page.locator(".plan")).to_have_count(2)
    expect(page.get_by_test_id("plan-single")).to_have_count(0)
    page.get_by_test_id("plan-pair").click()
    expect(page.get_by_test_id("pay-target-note")).to_contain_text("Сергей и Виктория")


def test_subscription_form_describes_the_subscription(page):
    """Форма подписки описывала разбор одной даты «без подписки» и обещала сохранить дату."""
    page.goto(f"{BASE}/pay/month", wait_until="networkidle")
    what = page.locator(".paybox .cap").first
    expect(what).to_contain_text("на 3 месяца")
    expect(what).not_to_contain_text("одной дате")
    expect(page.locator(".paybox")).not_to_contain_text("Выбранная дата")


def test_subscription_receipt_leads_to_the_calculator(page, mail):
    """Чек подписки без посчитанной даты звал «Открыть полный разбор», а /report перебрасывал на главную."""
    page.goto(f"{BASE}/pay/month", wait_until="networkidle")
    assert flows.pay(page, mail) == ""
    expect(page.get_by_test_id("receipt-calculate")).to_have_attribute("href", "/#calc")
