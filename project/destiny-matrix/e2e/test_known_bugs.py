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


def test_date_picked_before_hydration_is_the_one_that_gets_paid(page, mail):
    """Дата, выбранная до подключения React, не подменяется примером — и платёж идёт за неё.

    React монтируется со своим начальным состоянием и стирает то, что человек уже выбрал в полях.
    Пример карты на главной считается сам для «сегодня минус тридцать лет», поэтому подмена
    выглядела правдоподобно: на экране появлялась дата, которую никто не вводил, и платёж уходил
    за неё. Тот же класс, что A1: платим за то, что на экране.
    """
    flows.register(page, mail)
    flows.slow_scripts(page)
    page.goto(BASE, wait_until="commit")
    page.select_option("#d", "12")
    page.select_option("#m", "12")
    page.select_option("#y", "1992")
    page.get_by_test_id("sex-m").click()
    page.get_by_test_id("calc-submit").click()
    page.wait_for_timeout(1200)

    shown = page.locator("#result").inner_text()
    assert "12 декабря 1992" in shown, f"выбор до гидратации потерян, на экране: {shown[:120]}"

    flows.open_pay(page)
    assert "12 декабря 1992" in page.locator(".paybox").first.inner_text(), \
        "форма оплаты предлагает не ту дату, что на экране"
    flows.pay(page, mail)
    page.goto(f"{BASE}/report", wait_until="networkidle")
    page.wait_for_timeout(800)
    assert "12 декабря 1992" in page.inner_text("main"), \
        "оплачена не та дата, которую выбрали: " + page.inner_text("main")[:160]


def test_forms_never_put_the_password_in_the_address(page, mail):
    """Пока React не подключился, обработчик отправки не привязан, и браузер отправляет форму сам:
    почта с паролем уходили в строку адреса, а оттуда в логи сервера и в историю браузера.

    Защита двойная, и проверяем обе половины на странице с отключённым кодом: поля недоступны,
    пока форма не готова, а сама форма объявлена методом POST — значит даже при нативной отправке
    значения уйдут в теле запроса, а не в адресе.
    """
    flows.no_scripts(page)
    for path in ("/register", "/login"):
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        page.wait_for_timeout(400)

        assert page.locator("#email").is_disabled(), f"{path}: поле почты открыто до готовности"
        assert page.locator("#password").is_disabled(), f"{path}: поле пароля открыто до готовности"
        assert page.locator("form").first.get_attribute("method") == "post", \
            f"{path}: форма отправляется методом GET — значения уйдут в адрес"

        page.keyboard.press("Enter")
        page.wait_for_timeout(800)
        assert "password=" not in page.url and "@" not in page.url, \
            f"после отправки без кода в адресе оказались данные: {page.url}"


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


def test_sitemap_is_published_only_on_the_live_site(page):
    """A17 — состав карты сайта проверяет юнит (app/sitemap.test.ts), здесь важно другое: карта
    публикуется только на боевом адресе. Закрытый контур не должен сдавать поиску список своих
    страниц — он и так закрыт паролем и robots.txt."""
    body = page.request.get(f"{BASE}/sitemap.xml").text()

    if BASE.rstrip("/") == "https://arcana-sense.ru":
        assert "/contacts" in body, "в карте сайта нет /contacts"
        assert "/matrix/" in body, "в карте сайта нет страниц матриц"
    else:
        assert "<loc>" not in body, f"закрытый контур публикует свои адреса: {body[:200]}"

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
    said = re.search(r"за (\d+) плат[её]ж", numbers["cap"])
    assert said, f"сводки нет: {numbers['cap']!r}"
    assert int(said.group(1)) == numbers["paid"], (
        f"в сводке «{numbers['cap'].strip()}», а оплаченных строк {numbers['paid']} "
        f"из {numbers['all']}")
