"""Регрессии на дефекты первого круга (A1–A17), которые видно только в браузере.

A5, A12 и A16 живут в test_round2_bugs.py: там те же инварианты, но шире — все публичные страницы,
четыре ширины и три адреса 404. Держать по два теста на один инвариант значит гонять его дважды.
"""
from __future__ import annotations

import json
import re
import subprocess
import urllib.request
import uuid

import pytest
from playwright.sync_api import expect

import flows
from conftest import ADMIN, BASE

pytestmark = pytest.mark.bug

DATE = r"\d{1,2} \w+ \d{4}"


def test_a1_payment_opens_the_card_shown_on_screen(page, mail):
    """A1. Сохранена женская карта на ту же дату — покупка мужской открывает женскую."""
    flows.register(page, mail)
    flows.calculate(page, 3, 3, 1993, "f")
    flows.save_current(page)

    flows.calculate(page, 3, 3, 1993, "m")
    page.goto(f"{BASE}/report", wait_until="networkidle")
    assert "мужская карта" in page.inner_text("main")

    flows.open_pay(page)
    flows.pay(page, mail)
    page.goto(f"{BASE}/report", wait_until="networkidle")
    page.wait_for_timeout(800)
    assert "мужская карта" in page.inner_text("main"), \
        "оплатили мужскую карту, а открылась другая: " + page.inner_text("main")[:120]


def test_a3_second_tab_forgets_the_previous_person(page, mail):
    """A3. Человек сменился в одной вкладке — вторая, оставленная открытой, показывает прежнего."""
    flows.buy(page, mail, 4, 4, 1994)
    second = page.context.new_page()
    second.goto(f"{BASE}/account", wait_until="networkidle")
    second.wait_for_timeout(800)
    assert mail in second.inner_text("body")

    flows.logout(page)
    other = f"other-{uuid.uuid4().hex[:8]}@example.ru"
    flows.register(page, other)

    second.bring_to_front()
    second.wait_for_timeout(2500)
    body = second.inner_text("body")
    assert mail not in body, f"вкладка показывает почту предыдущего человека: {body[:200]}"


def test_a4_target_list_button_and_request_agree(page, mail):
    """A4. Список «Платёж откроет», надпись на кнопке и уходящий запрос должны звать одну дату."""
    flows.register(page, mail)
    flows.calculate(page, 5, 5, 1985)
    flows.save_current(page)
    known = flows.matrix_ids(page)

    sent: dict = {}

    def catch(route):
        sent.update(json.loads(route.request.post_data or "{}"))
        route.abort()

    page.route("**/payments/start", catch)
    page.goto(f"{BASE}/pay?m={max(known) + 50}", wait_until="networkidle")
    page.wait_for_timeout(1500)

    chosen = page.evaluate("""() => {
      const s = document.querySelector('[data-testid=pay-target]');
      return s && s.selectedIndex >= 0 ? s.options[s.selectedIndex].text : null;
    }""")
    button = page.get_by_test_id("pay-submit").inner_text()
    page.get_by_test_id("pay-email").fill(mail)
    if page.get_by_test_id("pay-password").count():
        page.get_by_test_id("pay-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click(force=True)
    page.wait_for_timeout(1500)

    date = re.search(DATE, chosen or "")
    assert date and date.group(0) in button, \
        f"список зовёт «{chosen}», кнопка «{button}»"
    assert sent.get("matrix_id") in (None, *known), \
        f"кнопка обещает «{button}», а запрос уходит за {sent}"


def test_a6_button_is_disabled_without_a_target(page, mail):
    """A6. Экран пишет «дата не выбрана» — значит платить нечем, кнопка должна быть неактивна."""
    flows.calculate(page, 7, 7, 1987)
    page.goto(f"{BASE}/pay", wait_until="networkidle")
    page.evaluate("() => sessionStorage.clear()")
    page.reload()
    page.wait_for_selector("[data-testid=pay-submit]")
    page.wait_for_timeout(1000)
    hint = page.inner_text("main")
    if "Дата не выбрана" in hint:
        assert page.get_by_test_id("pay-submit").is_disabled(), \
            "цели нет, а кнопка оплаты активна"


def test_a7_back_after_payment_shows_the_paid_report(page, mail):
    """A7. После оплаты «назад» доводит до страницы разбора — она не должна быть закрытой."""
    flows.calculate(page, 8, 8, 1988)
    page.goto(f"{BASE}/report", wait_until="networkidle")
    page.wait_for_timeout(800)
    assert flows.locked_sections(page) == 18

    flows.open_pay(page)
    flows.pay(page, mail)
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(1800)
    assert flows.locked_sections(page) == 0

    for _ in range(3):
        page.go_back()
        page.wait_for_timeout(1500)
        if page.url.rstrip("/").endswith("/report"):
            break
    assert page.url.rstrip("/").endswith("/report"), f"до разбора не дошли: {page.url}"
    assert flows.locked_sections(page) == 0, \
        f"«назад» вернуло закрытый разбор: замков {flows.locked_sections(page)}"


def test_a8_no_account_is_created_without_a_target(page, mail):
    """A8. Отказ по причине «нет даты» не должен создавать аккаунт и сессию."""
    page.goto(f"{BASE}/pay", wait_until="networkidle")
    page.evaluate("() => sessionStorage.clear()")
    page.reload()
    page.wait_for_selector("[data-testid=pay-email]")
    page.get_by_test_id("pay-email").fill(mail)
    if page.get_by_test_id("pay-password").count():
        page.get_by_test_id("pay-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click(force=True)
    page.wait_for_timeout(2500)

    answer = page.request.get(f"{BASE}/api/auth/me")
    assert answer.status != 200, "аккаунт создан и сессия выдана, хотя платёж не начинался"


def test_a9_buy_button_after_payment_opens_the_form(page, mail):
    """A9. «Купить» после оплаты должен открывать форму, а не прошлый чек."""
    flows.buy(page, mail, 9, 9, 1989)
    page.get_by_test_id("buy-top").click()
    page.wait_for_timeout(1500)
    assert page.get_by_test_id("pay-submit").count() == 1, \
        "на /pay остался чек, формы оплаты нет"


def test_a11_pdf_keeps_the_footer(page, mail):
    """A11. Подпись внизу разбора должна попадать в файл: лист упирался в предел формата."""
    flows.buy(page, mail, 14, 3, 1990, sex="f")
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(1500)
    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)

    with page.expect_response(
        lambda r: "/api/reports/pdf" in r.url and r.status == 200, timeout=180_000
    ) as caught:
        button.click()
    with urllib.request.urlopen(caught.value.json()["url"], timeout=90) as file:
        pdf = file.read()

    words = subprocess.run(["pdftotext", "-", "-"], input=pdf,
                           capture_output=True).stdout.decode(errors="replace")
    assert "arcana-sense.ru" in words, "подписи «Arcana Sense · arcana-sense.ru» в файле нет"


def test_a13_consent_links_open_in_a_new_tab(page, mail):
    """A13. Ссылки в согласии не должны уводить со страницы оплаты вместе с введёнными полями."""
    page.set_viewport_size({"width": 390, "height": 844})
    flows.calculate(page, 10, 10, 1990)
    flows.open_pay(page)
    targets = page.locator(".consent a").evaluate_all(
        "els => els.map(e => e.getAttribute('target'))")
    assert targets and all(t == "_blank" for t in targets), \
        f"ссылки в согласии открываются в этой же вкладке: {targets}"


def test_a17_contacts_is_in_the_sitemap(page):
    """A17. Страница контактов должна быть в карте сайта."""
    body = page.request.get(f"{BASE}/sitemap.xml").text()
    assert "/contacts" in body, "в sitemap.xml нет /contacts"


def test_a14_admin_summary_counts_paid_payments_only(page, mail):
    """A14. «Оплачено X ₽ за N платежей»: сумма считается по оплаченным, а N — по всем строкам."""
    flows.buy(page, mail, 12, 12, 1992)
    flows.logout(page)
    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    page.wait_for_timeout(2500)

    numbers = page.evaluate("""() => {
      const rows = Array.from(document.querySelectorAll('[data-testid=admin-payments] tbody tr'));
      // статус — отдельная ячейка: «не оплачен» содержит «оплачен» как подстроку
      const paid = rows.filter((r) => (r.cells[4]?.innerText ?? '').trim() === 'оплачен').length;
      const cap = document.querySelector('[data-testid=admin-users]')
        ?.closest('.panel')?.querySelector('.cap')?.innerText ?? '';
      return {paid, all: rows.length, cap};
    }""")
    said = re.search(r"за (\d+) платеж", numbers["cap"])
    assert said, f"сводки нет: {numbers['cap']!r}"
    assert int(said.group(1)) == numbers["paid"], (
        f"в сводке «{numbers['cap'].strip()}», а оплаченных строк {numbers['paid']} "
        f"из {numbers['all']}")
