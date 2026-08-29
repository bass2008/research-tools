"""Длинная цепочка на живом эквайринге: две удачные оплаты, отказ, затем ещё одна удачная.

Запускается отдельно: стенд должен работать на провайдере tbank (ключи тестового терминала).
    PAYMENT_PROVIDER=tbank MAIL_TO_LOG=1 ./scripts/run.sh
    pytest -m bank
"""
from __future__ import annotations

import pathlib
import subprocess
import time

import pytest
from playwright.sync_api import expect

import flows
from conftest import ADMIN, BASE

pytestmark = pytest.mark.bank


def test_four_purchases_in_a_row_open_exactly_what_was_chosen(page, mail):
    dates = [(2, 3, 1993), (20, 3, 1993), (31, 3, 1993), (11, 8, 2004)]
    cards = [flows.GOOD_CARD, flows.GOOD_CARD, flows.BAD_CARD, flows.GOOD_CARD]
    outcomes = []

    for (day, month, year), card in zip(dates, cards):
        flows.calculate(page, day, month, year)
        flows.open_pay(page)
        assert flows.label(day, month, year) in page.get_by_test_id("pay-submit").inner_text()
        flows.pay_on_bank_form_start(page, mail)
        flows.pay_on_bank_form(page, card)
        outcomes.append(page.url)
        if "/pay/done" in page.url:
            expect(page.locator(".paybox h3")).to_contain_text("Доступ открыт", timeout=60_000)
            page.get_by_role("link", name="Открыть полный разбор").click()
            page.wait_for_timeout(1500)
            assert flows.locked_sections(page) == 0

    assert outcomes[2].endswith("fail") or "/pay/fail" in outcomes[2], outcomes

    flows.account(page)
    cards_text = {}
    items = flows.matrix_cards(page)
    for i in range(items.count()):
        text = items.nth(i).inner_text()
        head = text.split("\n")[0]
        cards_text[head] = "куплена" in text.lower()

    for day, month, year in (dates[0], dates[1], dates[3]):
        key = f"Матрица {flows.label(day, month, year)}"
        assert cards_text.get(key) is True, (key, cards_text)
    отказ = f"Матрица {flows.label(*dates[2])}"
    assert cards_text.get(отказ) is False, (отказ, cards_text)


def test_notification_opens_access_without_the_browser(page, mail, api_notify):
    """Доступ открывает уведомление провайдера, а не страница возврата: браузер тут не участвует.

    На стенде уведомление посылает себе сам сервис — банк до 127.0.0.1 не дотянется, — но подпись
    и обработка те же, что в проде.
    """
    flows.register(page, mail)
    flows.calculate(page, 24, 4, 1991)
    flows.open_pay(page)
    matrix_id = None
    with page.expect_navigation(url=lambda u: "pay.tbank.ru" in u or "securepay" in u,
                               timeout=60_000):
        flows.pay_on_bank_form_start(page, mail)

    payment_id = page.request.get(f"{BASE}/api/payments").json()["items"][0]["external_id"]
    matrix_id = page.request.get(f"{BASE}/api/payments").json()["items"][0]["matrix_id"]
    assert page.request.get(f"{BASE}/api/matrices/{matrix_id}").json()["unlocked"] is False

    api_notify(payment_id, "CONFIRMED")

    assert page.request.get(f"{BASE}/api/matrices/{matrix_id}").json()["unlocked"] is True
    flows.account(page)
    assert "куплена" in flows.matrix_cards(page).first.inner_text().lower()


def sweep_now() -> str:
    """Досверка платежей — то же, что делает cron на машине."""
    compose = pathlib.Path(__file__).resolve().parent.parent / "compose" / "docker-compose.yml"
    done = subprocess.run(["docker", "compose", "-f", str(compose), "exec", "-T", "api",
                           "python", "-m", "app.sweep"], capture_output=True, text=True)
    assert done.returncode == 0, done.stderr or done.stdout
    return (done.stdout + done.stderr).strip()


def test_leaving_the_form_still_opens_access_by_sweep(page, mail):
    """Человек заплатил и закрыл вкладку, не дождавшись возврата: доступ открывает досверка."""
    flows.register(page, mail)
    flows.calculate(page, 6, 6, 1986)
    flows.open_pay(page)
    with page.expect_navigation(url=lambda u: "pay.tbank.ru" in u or "securepay" in u,
                               timeout=60_000):
        flows.pay_on_bank_form_start(page, mail)

    matrix_id = page.request.get(f"{BASE}/api/payments").json()["items"][0]["matrix_id"]
    flows.pay_on_bank_form(page, flows.GOOD_CARD)
    # уходим со страницы возврата до того, как она успела сверить статус
    page.goto(f"{BASE}/account", wait_until="domcontentloaded")

    log = sweep_now()
    unlocked = page.request.get(f"{BASE}/api/matrices/{matrix_id}").json()["unlocked"]
    assert unlocked is True, f"досверка не открыла доступ. Лог прогона: {log[-300:]}"


def test_refund_of_a_paid_payment_takes_the_access_back(page, mail, api_log):
    """Отмена уже списанного платежа — это возврат: доступ снимается, письмо уходит."""
    flows.buy_on_bank(page, mail, 7, 7, 1987)
    matrix_id = page.request.get(f"{BASE}/api/payments").json()["items"][0]["matrix_id"]
    payment_id = page.request.get(f"{BASE}/api/payments").json()["items"][0]["id"]
    assert page.request.get(f"{BASE}/api/matrices/{matrix_id}").json()["unlocked"] is True

    flows.logout(page)
    flows.login(page, *ADMIN)
    answer = page.request.post(f"{BASE}/api/admin/payments/{payment_id}/refund")
    assert answer.ok, answer.text()

    flows.logout(page)
    flows.login(page, mail)
    fresh = page.request.get(f"{BASE}/api/matrices/{matrix_id}").json()
    assert fresh["unlocked"] is False, "после возврата доступ остался открытым"
    row = page.request.get(f"{BASE}/api/payments").json()["items"][0]
    assert row["refunded_at"], f"платёж не помечен возвращённым: {row}"
    assert api_log("возврат") or api_log("Возврат"), "письма о возврате нет в логе"


def test_cancel_before_capture_is_a_failure_not_a_refund(page, mail):
    """Отмена платежа, по которому денег ещё не списали: прав не было и не появилось."""
    flows.register(page, mail)
    flows.calculate(page, 8, 8, 1988)
    flows.open_pay(page)
    with page.expect_navigation(url=lambda u: "pay.tbank.ru" in u or "securepay" in u,
                               timeout=60_000):
        flows.pay_on_bank_form_start(page, mail)

    row = page.request.get(f"{BASE}/api/payments").json()["items"][0]
    matrix_id, payment_id = row["matrix_id"], row["id"]

    flows.logout(page)
    flows.login(page, *ADMIN)
    answer = page.request.post(f"{BASE}/api/admin/payments/{payment_id}/refund")
    assert answer.ok, answer.text()

    flows.logout(page)
    flows.login(page, mail)
    after = page.request.get(f"{BASE}/api/payments").json()["items"][0]
    assert page.request.get(f"{BASE}/api/matrices/{matrix_id}").json()["unlocked"] is False
    assert not after["paid_at"], f"неоплаченный платёж отмечен оплаченным: {after}"
    assert not after["refunded_at"], (
        f"снятый холд записан как возврат — человек денег не платил: {after}")


def test_two_tabs_do_not_create_two_payments_for_one_date(page, mail):
    """Гонка, которую создаёт продукт: дата лежит в кабинете, человек открыл её оплату в двух
    вкладках (вторая — «открыть в новой вкладке» на той же ссылке) и заплатил в обеих."""
    flows.register(page, mail)
    flows.calculate(page, 9, 9, 1989)
    flows.save_current(page)
    matrix_id = flows.matrix_ids(page)[0]

    first = page
    first.goto(f"{BASE}/pay?m={matrix_id}", wait_until="networkidle")
    first.wait_for_timeout(1500)
    second = page.context.new_page()
    second.goto(f"{BASE}/pay?m={matrix_id}", wait_until="networkidle")
    second.wait_for_timeout(1500)
    assert not second.get_by_test_id("pay-submit").is_disabled(), \
        "вторая вкладка не видит цель — гонку так не проверить"

    with first.expect_navigation(url=lambda u: "pay.tbank.ru" in u or "securepay" in u,
                                 timeout=60_000):
        flows.pay_on_bank_form_start(first, mail)
    first.wait_for_timeout(3000)                    # пауза между платежами, §15 цикла
    flows.pay_on_bank_form_start(second, mail)
    second.wait_for_timeout(8000)

    rows = first.request.get(f"{BASE}/api/payments").json()["items"]
    for_date = [r for r in rows if r["matrix_id"] == matrix_id]
    assert len(for_date) == 1, (
        f"на одну дату создано платежей: {len(for_date)} — вторая вкладка выставила ещё счёт. "
        f"{[(r['external_id'], r['status']) for r in for_date]}")


def test_paid_date_cannot_be_bought_again_on_the_bank(page, mail):
    """Уже открытую дату калькулятор сразу ведёт в её разбор, не на повторную оплату."""
    flows.buy_on_bank(page, mail, 12, 12, 1992)
    matrix_id = flows.matrix_ids(page)[0]
    flows.calculate(page, 12, 12, 1992)
    page.wait_for_url(f"{BASE}/?m={matrix_id}#result", timeout=20_000)
    assert flows.locked_sections(page) == 0
    assert page.get_by_test_id("unlock-cta").count() == 0, "открытую дату предлагают купить снова"


def test_result_page_does_not_flicker_or_reload_itself(page, mail):
    """Страница возврата не перезагружает себя, не теряет человека в шапке и не обещает исход
    заранее. Раньше здесь шло: сверка → появилась почта → перезагрузка → снова сверка, а шапка
    мигала надписью «проверяем доступ…» вместо почты."""
    loads: list[float] = []
    page.on("load", lambda _: loads.append(time.time()))

    flows.register(page, mail)
    flows.calculate(page, 9, 9, 1989)
    flows.open_pay(page)
    flows.pay_on_bank_form_start(page, mail)
    flows.pay_on_bank_form(page, flows.GOOD_CARD)

    loads.clear()
    titles, badges = set(), set()
    for _ in range(16):                      # восемь секунд наблюдения
        page.wait_for_timeout(500)
        titles.add(page.title())
        header = page.inner_text("header")
        badges.add("почта" if mail in header else
                   ("служебная надпись" if "проверяем доступ" in header else "гость"))

    assert not loads, f"страница перезагрузила себя {len(loads)} раз"
    assert badges == {"почта"}, f"шапка теряет человека: {badges}"
    assert "Оплата прошла" in page.title(), f"заголовок вкладки: {page.title()}"
    assert not any("Оплата прошла" in t for t in titles if t != page.title()), \
        f"заголовок обещал исход до ответа банка: {titles}"
