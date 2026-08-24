"""Регрессии на дефекты цикла step1-1 (D2–D8)."""
from __future__ import annotations

import json
import re

import pytest
import flows
from conftest import BASE

pytestmark = pytest.mark.bug

def test_d2_paying_from_the_plans_block_shows_the_receipt(page, mail):
    """D2. Кнопка «Купить за 250 ₽» из блока тарифов ведёт на /pay/<тариф>, и после оплаты человек
    остаётся на форме: чека «Доступ открыт» нет, непонятно, прошло ли."""
    flows.calculate(page, 5, 5, 1985)
    page.goto(f"{BASE}/pay/single", wait_until="networkidle")
    page.wait_for_timeout(1200)
    flows.pay(page, mail)
    page.wait_for_timeout(2000)

    assert page.get_by_test_id("paid-matrix").count() == 1, (
        f"чека нет, на экране {'форма оплаты' if page.get_by_test_id('pay-submit').count() else 'что-то другое'}; "
        f"url={page.url}")


def test_d3_link_without_a_session_does_not_silently_switch_the_date(page, mail):
    """D3. Ссылка «Открыть — 250 ₽» на другом устройстве (сессии нет): номер подтвердить нельзя, и
    форма молча платит за дату из браузера вместо обещанной."""
    flows.register(page, mail)
    flows.calculate(page, 21, 11, 1965)
    flows.save_current(page)
    wanted = flows.matrix_ids(page)[0]
    flows.logout(page)

    flows.calculate(page, 4, 7, 1994)               # в браузере другая дата
    sent: dict = {}
    page.route("**/payments/start", lambda route: (
        sent.update(json.loads(route.request.post_data or "{}")), route.abort()))
    page.goto(f"{BASE}/pay?m={wanted}", wait_until="networkidle")
    page.wait_for_timeout(1500)

    hint = page.inner_text("main")
    if page.get_by_test_id("pay-submit").is_disabled():
        assert "войд" in hint.lower() or "вход" in hint.lower(), \
            f"кнопка погашена, но не сказано, что нужно войти: {hint[:200]}"
        return

    page.get_by_test_id("pay-email").fill(mail)
    if page.get_by_test_id("pay-password").count():
        page.get_by_test_id("pay-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click(force=True)
    page.wait_for_timeout(1200)
    assert sent.get("matrix_id") == wanted, (
        f"адрес обещает m={wanted}, а платёж уходит за {sent}. Экран: {hint[:160]}")


def test_d5_password_reset_works_while_another_session_is_alive(page, mail, api_log):
    """D5. Общий компьютер: жива сессия другого человека. Переход по ссылке из письма меняет пароль,
    но экран возвращает на ту же форму, а вторая попытка говорит «ссылка недействительна»."""
    other = f"other-{mail}"
    flows.register(page, other)                     # чужая сессия осталась в браузере

    page.goto(f"{BASE}/register", wait_until="networkidle")
    page.get_by_test_id("auth-email").fill(mail)
    page.get_by_test_id("auth-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    page.wait_for_timeout(1500)
    flows.logout(page)
    flows.register(page, other + "x")               # снова чужая живая сессия

    page.goto(f"{BASE}/forgot", wait_until="networkidle")
    page.get_by_test_id("forgot-email").fill(mail)
    page.get_by_test_id("forgot-submit").click()
    page.wait_for_timeout(2500)
    link = flows.token_from(api_log("/reset?token="))
    assert link, "ссылки восстановления нет в логе"

    page.goto(f"{BASE}/reset?token={link}", wait_until="networkidle")
    page.get_by_test_id("reset-password").fill("новыйпароль1")
    page.get_by_test_id("reset-submit").click()
    page.wait_for_timeout(2500)

    body = page.inner_text("body")
    assert "недействительна" not in body, f"экран говорит, что ссылка не годится: {body[:200]}"
    flows.login(page, mail, "новыйпароль1")
    assert mail in page.inner_text("body"), "новым паролем войти не удалось"


@pytest.mark.parametrize("width", (320, 360))
def test_d6_month_names_fit_in_the_encyclopedia_calculator(page, width):
    """D6. В мини-калькуляторе энциклопедии на узком экране обрезаны длинные названия месяцев."""
    page.set_viewport_size({"width": width, "height": 780})
    page.goto(f"{BASE}/encyclopedia/arcanum/7", wait_until="domcontentloaded")
    page.wait_for_timeout(900)

    room = page.evaluate("""() => {
      const s = document.querySelector('#pm');
      if (!s) return null;
      const css = getComputedStyle(s);
      const c = document.createElement('canvas').getContext('2d');
      c.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
      const arrow = 26;
      const available = Math.round(s.clientWidth - parseFloat(css.paddingLeft)
                                   - parseFloat(css.paddingRight) - arrow);
      const tight = Array.from(s.options)
        .map((o) => ({ text: o.text, needed: Math.round(c.measureText(o.text).width) }))
        .filter((x) => x.needed > available);
      return { available, tight };
    }""")
    assert room, "мини-калькулятора нет на странице аркана"
    assert not room["tight"], (
        f"на {width}px не влезают: {room['tight']} при доступных {room['available']}px")


def test_d7_matrix_pages_agree_the_number_of_dates(page):
    """D7. На страницах матриц «1 дат», «2 дат», «3 дат» вместо «1 дата», «2 даты»."""
    slugs = re.findall(r"/matrix/([0-9-]+)</loc>", page.request.get(f"{BASE}/sitemap.xml").text())
    assert slugs, "в карте сайта нет страниц матриц"

    bad = []
    for slug in slugs[:60]:
        page.goto(f"{BASE}/matrix/{slug}", wait_until="domcontentloaded")
        page.wait_for_timeout(120)
        text = page.inner_text("body")
        for found in re.finditer(r"\b(\d+) дат\b", text):
            number = int(found.group(1))
            tail, hundred = number % 10, number % 100
            if not (11 <= hundred <= 14) and (tail == 1 or 2 <= tail <= 4):
                bad.append(f"/matrix/{slug}: «{number} дат»")
    assert not bad, "число дат не согласовано: " + "; ".join(bad[:6])


def test_d8_matrix_pages_do_not_name_dates_that_do_not_exist(page):
    """D8. Пояснение под списком дат называет «30 февраля» и другие несуществующие числа."""
    days = {"января": 31, "февраля": 28, "марта": 31, "апреля": 30, "мая": 31, "июня": 30,
            "июля": 31, "августа": 31, "сентября": 30, "октября": 31, "ноября": 30, "декабря": 31}
    all_slugs = re.findall(r"/matrix/([0-9-]+)</loc>",
                           page.request.get(f"{BASE}/sitemap.xml").text())
    # берём именно те карты, где «день + 22» вылезает за конец месяца: 30 февраля, 31 апреля и т.п.
    short = {2: 28, 4: 30, 6: 30, 9: 30, 11: 30}
    slugs = [s for s in all_slugs
             if (lambda p: len(p) == 3 and p[1] in short and p[0] + 22 > short[p[1]]
                 and p[0] + 22 <= 31)(list(map(int, s.split("-"))))][:40]
    assert slugs, "не нашлось карт, где пояснение обещает несуществующее число"

    bad = []
    for slug in slugs:
        page.goto(f"{BASE}/matrix/{slug}", wait_until="domcontentloaded")
        page.wait_for_timeout(120)
        text = page.inner_text("body")
        for found in re.finditer(r"поэтому (\d+) и (\d+) (\w+) дают", text):
            first, second, month = int(found.group(1)), int(found.group(2)), found.group(3)
            limit = days.get(month, 31)
            for day in (first, second):
                if day > limit:
                    bad.append(f"/matrix/{slug}: «{day} {month}»")
    assert not bad, "страница называет несуществующую дату: " + "; ".join(sorted(set(bad))[:6])


def test_p2_calculator_button_does_not_swallow_the_first_click(page):
    """P2. Клик по «Рассчитать» в первую секунду после загрузки терялся: обработчик ещё не подключён,
    и человек на медленном телефоне решал, что сайт сломан."""
    page.goto(BASE, wait_until="domcontentloaded")
    page.select_option("#d", "7")
    page.select_option("#m", "3")
    page.select_option("#y", "1990")

    button = page.get_by_test_id("calc-submit")
    if button.is_disabled():
        assert "готовим" in button.inner_text().lower(), \
            f"кнопка не работает и молчит об этом: «{button.inner_text()}»"
        page.wait_for_timeout(2500)
        assert not button.is_disabled(), "кнопка так и не включилась"
        return

    button.click(force=True)
    page.wait_for_timeout(2500)
    assert "7 марта 1990" in page.inner_text("body"), \
        "клик по «Рассчитать» ничего не сделал: расчёта нет"


def test_q1_pay_form_does_not_promise_silence_about_email(page, mail):
    """Q1. Форма обещала «писем мы не отправляем», хотя после покупки письмо уходит."""
    flows.calculate(page, 5, 5, 1985)
    flows.open_pay(page)
    page.wait_for_timeout(800)
    text = page.inner_text("main")
    assert "писем мы не отправляем" not in text, \
        "форма обещает, что писем не будет, а письмо о покупке уходит"


def test_q2_not_found_pages_do_not_canonicalize_to_the_home_page(page):
    """Q2. Любой 404 объявлял каноническим адресом главную — поисковик считал его её копией.

    Заголовок вкладки на 404 задаётся разметкой и потому появляется после гидратации: Next при
    `notFound()` отбрасывает метаданные сегмента. Здесь проверяется то, что видит краулер: код
    ответа, `noindex` и отсутствие чужого canonical.
    """
    bad = []
    for path in ("/net-takoy-stranicy", "/matrix/net-takogo-slaga", "/encyclopedia/arcanum/999"):
        answer = page.request.get(f"{BASE}{path}")
        html = answer.text()
        if answer.status != 404:
            bad.append(f"{path}: код {answer.status}")
        if "noindex" not in html:
            bad.append(f"{path}: нет noindex")
        canonical = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        if canonical:
            bad.append(f"{path}: canonical → {canonical.group(1)}")
    assert not bad, "; ".join(bad)

    page.goto(f"{BASE}/net-takoy-stranicy", wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    assert "не найден" in page.title().lower(), f"заголовок вкладки: {page.title()}"


@pytest.mark.parametrize("width", (320, 390))
def test_q3_result_heading_is_not_hidden_under_the_sticky_header(page, width):
    """Q3. Сразу после расчёта заголовок результата уходил под липкую шапку."""
    page.set_viewport_size({"width": width, "height": 780})
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1500)
    page.select_option("#d", "7")
    page.select_option("#m", "3")
    page.select_option("#y", "1990")
    page.get_by_test_id("sex-m").click()
    page.get_by_test_id("calc-submit").click()
    page.wait_for_timeout(2000)

    overlap = page.evaluate("""() => {
      const header = document.querySelector('.site-header');
      const head = document.querySelector('#result h3, #result .cap');
      if (!header || !head) return null;
      const h = header.getBoundingClientRect(), t = head.getBoundingClientRect();
      return { headerBottom: Math.round(h.bottom), headingTop: Math.round(t.top),
               text: head.innerText.slice(0, 40) };
    }""")
    assert overlap, "после расчёта нет блока результата"
    assert overlap["headingTop"] >= overlap["headerBottom"] - 1, (
        f"на {width}px «{overlap['text']}» под шапкой: верх {overlap['headingTop']}, "
        f"шапка кончается на {overlap['headerBottom']}")
