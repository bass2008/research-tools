"""Шаги, из которых собираются сценарии: те же действия, что делает человек."""
from __future__ import annotations

import re
import time

from playwright.sync_api import Page, expect

from conftest import BASE

MONTHS = ("января", "февраля", "марта", "апреля", "мая", "июня",
          "июля", "августа", "сентября", "октября", "ноября", "декабря")


def label(day: int, month: int, year: int) -> str:
    return f"{day} {MONTHS[month - 1]} {year}"


def slow_scripts(page: Page, ms: int = 1500) -> None:
    """Задержать код страницы: разметка уже видна, а React ещё не подключился. Так проверяется
    то, что человек на медленном телефоне делает всегда — трогает поля до гидратации."""
    def hold(route):
        time.sleep(ms / 1000)
        route.continue_()

    page.route("**/_next/static/chunks/**", hold, times=1)   # тормозим один кусок, не всю загрузку


def no_scripts(page: Page) -> None:
    """Страница вообще без своего кода: остаётся то, что делает сам браузер."""
    page.route("**/_next/static/chunks/**", lambda route: route.abort())


def calculate(page: Page, day: int, month: int, year: int, sex: str = "m") -> None:
    page.goto(BASE, wait_until="domcontentloaded")
    page.select_option("#d", str(day))
    page.select_option("#m", str(month))
    page.select_option("#y", str(year))
    page.get_by_test_id(f"sex-{sex}").click()
    page.get_by_test_id("calc-submit").click()
    page.wait_for_timeout(900)


def open_pay(page: Page) -> None:
    page.get_by_test_id("buy-top").click()
    expect(page.get_by_test_id("pay-submit")).to_be_visible()
    page.wait_for_timeout(600)


def pay(page: Page, email: str, password: str = "1234") -> str:
    """Нажать «Оплатить» и дождаться исхода: либо экран «Доступ открыт», либо ошибка."""
    page.get_by_test_id("pay-email").fill(email)
    if page.get_by_test_id("pay-password").count():
        page.get_by_test_id("pay-password").fill(password)
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    page.wait_for_function(
        """() => document.querySelector('[data-testid=paid-matrix]')
                || document.querySelector('.paybox h3')?.innerText.includes('Доступ открыт')
                || document.querySelector('.err')""",
        timeout=60_000)
    error = page.locator(".err")
    return error.first.inner_text().strip() if error.count() else ""


def buy(page: Page, email: str, day: int, month: int, year: int, password: str = "1234",
        sex: str = "m") -> str:
    calculate(page, day, month, year, sex)
    open_pay(page)
    return pay(page, email, password)


def register(page: Page, email: str, password: str = "1234") -> None:
    page.goto(f"{BASE}/register", wait_until="domcontentloaded")
    page.get_by_test_id("auth-email").fill(email)
    page.get_by_test_id("auth-password").fill(password)
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    page.wait_for_url(f"{BASE}/account", timeout=15_000)
    page.wait_for_timeout(500)


def login(page: Page, email: str, password: str = "1234") -> None:
    page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    page.get_by_test_id("auth-email").fill(email)
    page.get_by_test_id("auth-password").fill(password)
    page.get_by_test_id("auth-submit").click()
    page.wait_for_url(f"{BASE}/account", timeout=15_000)
    page.wait_for_timeout(500)


def locked_sections(page: Page) -> int:
    return page.locator("[data-locked=true]").count()


def open_sections(page: Page) -> int:
    return page.locator("details.acc").count()


def account(page: Page) -> None:
    page.goto(f"{BASE}/account", wait_until="domcontentloaded")
    page.wait_for_timeout(800)


def matrix_cards(page: Page):
    return page.get_by_test_id("matrix-card")


def token_from(line: str | None) -> str | None:
    if not line:
        return None
    found = re.search(r"token=([A-Za-z0-9._-]+)", line)
    return found.group(1) if found else None


def save_current(page: Page) -> None:
    """Сохранить дату из браузера в кабинет — кнопка живёт в кабинете под списком матриц."""
    account(page)
    page.get_by_test_id("save-matrix").click()
    page.wait_for_timeout(1200)


def matrix_ids(page: Page) -> list[int]:
    """Номера матриц владельца — из ссылок на карточках кабинета."""
    account(page)
    hrefs = page.locator("[data-testid=matrix-card] a").evaluate_all(
        "els => els.map(e => e.getAttribute('href'))")
    out = []
    for href in hrefs:
        found = re.search(r"/matrices/(\d+)", href or "")
        if found:
            out.append(int(found.group(1)))
    return sorted(set(out))


def logout(page: Page) -> None:
    if page.get_by_test_id("logout").count():
        page.get_by_test_id("logout").click()
        page.wait_for_timeout(700)


# Карты тестового терминала: первая проходит и формирует чек, вторая нужна для проверки
# возврата (по ней банк делает и чек возврата), третья всегда получает отказ.
GOOD_CARD = "4000000000000101"
REFUND_CARD = "5000000000000108"
BAD_CARD = "4300000000000785"


def pay_on_bank_form(page: Page, card: str) -> None:
    """Заполнить форму банка. Поля с маской: ввод идёт одним потоком, фокус переходит сам."""
    page.wait_for_url(re.compile(r"pay\.tbank\.ru|securepay"), timeout=60_000)
    page.wait_for_timeout(2500)
    page.click("input[automation-id='tui-input-card-group__card']")
    page.keyboard.type(card, delay=55)
    page.keyboard.type("1230", delay=55)
    page.keyboard.type("111", delay=55)
    page.wait_for_timeout(600)
    page.evaluate("""() => {
      const b = Array.from(document.querySelectorAll('button'))
        .find(x => /pay|оплатить/i.test(x.innerText) && !x.disabled);
      if (b) b.click();
    }""")
    page.wait_for_url(re.compile(r"/pay/(done|fail)"), timeout=180_000)
    page.wait_for_timeout(1500)


def pay_on_bank_form_start(page: Page, email: str, password: str = "1234") -> None:
    """Заполнить нашу форму и уйти на форму банка."""
    page.get_by_test_id("pay-email").fill(email)
    if page.get_by_test_id("pay-password").count():
        page.get_by_test_id("pay-password").fill(password)
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()


def buy_on_bank(page: Page, email: str, day: int, month: int, year: int,
                card: str = GOOD_CARD, sex: str = "m") -> None:
    """Покупка через настоящую форму банка: расчёт, наша форма, форма банка, возврат."""
    calculate(page, day, month, year, sex)
    open_pay(page)
    pay_on_bank_form_start(page, email)
    pay_on_bank_form(page, card)
