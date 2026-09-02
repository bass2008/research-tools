"""Цикл 8, ступень 1: формы, кабинет, доступ, админка. Раунд 3.

Тесты написаны до правок и падали по существу дефекта.
"""
from __future__ import annotations

import re
import uuid

import pytest
from playwright.sync_api import Page, expect

import flows
from conftest import ADMIN, BASE

pytestmark = pytest.mark.bug


def _mail(tag: str) -> str:
    return f"agent-{tag}-{uuid.uuid4().hex[:8]}@example.com"


def test_form_error_clears_once_the_field_is_fixed(page: Page):
    """Сообщение «Нужно согласие…» висело и после того, как галочку поставили: форма продолжала
    требовать сделанное."""
    page.goto(f"{BASE}/register", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="auth-submit"]:not([disabled])')
    page.get_by_test_id("auth-email").fill(_mail("errclear"))
    page.get_by_test_id("auth-password").fill("secret1")
    page.get_by_test_id("auth-submit").click()
    expect(page.locator(".err")).to_be_visible(timeout=10_000)

    page.locator(".consent input[type=checkbox]").check()
    page.wait_for_timeout(600)
    assert page.locator(".err").count() == 0, (
        f"после исправления поля осталось: «{page.locator('.err').first.inner_text()}»"
    )


def test_pay_form_forgets_the_other_account_when_the_email_changes(page: Page):
    """Отказ «на эту почту уже есть аккаунт» оставался на форме после смены почты: у новой почты
    аккаунта нет, а форма требовала пароль от него."""
    known = _mail("known")
    flows.register(page, known, "abcdef")
    flows.logout(page)

    flows.calculate(page, 9, 2, 1985)
    page.goto(f"{BASE}/pay", wait_until="domcontentloaded")
    page.wait_for_selector("[data-testid=pay-submit]")
    page.get_by_test_id("pay-email").fill(known)
    page.get_by_test_id("pay-password").fill("wrongpass")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    expect(page.locator(".err")).to_be_visible(timeout=30_000)

    page.get_by_test_id("pay-email").fill(_mail("fresh"))
    page.wait_for_timeout(700)
    hint = page.inner_text("form")
    assert "уже есть аккаунт" not in hint, "форма всё ещё говорит про чужой аккаунт"


def test_rename_keeps_the_typed_name_when_the_server_refuses(page: Page):
    """Отказ сети закрывал поле и выбрасывал набранное имя: человек терял ввод и не видел, что
    случилось."""
    mail = _mail("rename")
    flows.register(page, mail)
    flows.calculate(page, 3, 3, 1993)
    flows.save_current(page)

    page.route("**/api/matrices/*", lambda route: route.abort())
    page.get_by_test_id("rename-matrix").first.click()
    field = page.get_by_test_id("rename-input").first
    field.fill("Ценное имя")
    page.get_by_test_id("rename-save").first.click()
    page.wait_for_timeout(1500)

    assert page.get_by_test_id("rename-input").count(), "поле закрылось, набранное имя потеряно"
    assert page.get_by_test_id("rename-input").first.input_value() == "Ценное имя"


def test_rename_by_enter_sends_one_request(page: Page):
    """Enter не проверял, что запрос уже идёт: четыре нажатия давали четыре PATCH."""
    mail = _mail("enter")
    flows.register(page, mail)
    flows.calculate(page, 4, 4, 1994)
    flows.save_current(page)

    sent: list[str] = []

    def slow(route):
        sent.append(route.request.method)
        page.wait_for_timeout(1200)
        route.continue_()

    page.route("**/api/matrices/*", slow)
    page.get_by_test_id("rename-matrix").first.click()
    field = page.get_by_test_id("rename-input").first
    field.fill("Имя ААА")
    for _ in range(4):
        field.press("Enter")
        page.wait_for_timeout(120)
    page.wait_for_timeout(2500)

    patches = [m for m in sent if m == "PATCH"]
    assert len(patches) == 1, f"ушло {len(patches)} запросов переименования вместо одного"


def test_catalogue_does_not_prefetch_every_card(page: Page):
    """264 карточки каталога тянули RSC-пейлоад каждой страницы: просмотр сетки ссылок стоил
    мегабайты трафика."""
    seen: list[str] = []
    page.on("response", lambda r: seen.append(r.url) if "_rsc=" in r.url else None)
    page.goto(f"{BASE}/matrix", wait_until="domcontentloaded")
    for _ in range(8):
        page.mouse.wheel(0, 900)
        page.wait_for_timeout(400)
    page.wait_for_timeout(3000)
    # Считаем именно карточки, а не все запросы: общий предел был заложником стратегии Next.
    # В 16 навигация запрашивает каждый адрес шапки и подвала дважды (17 адресов → 37 запросов),
    # и порог 30 краснел, хотя ни одна из 264 карточек пейлоад не тянула.
    cards = [u for u in seen if u.startswith(f"{BASE}/matrix/")]
    assert not cards, f"каталог тянет пейлоады карточек: {len(cards)}, например {cards[:2]}"
    assert len({u.split("?")[0] for u in seen}) <= 25, (
        f"каталог запросил пейлоады {len({u.split('?')[0] for u in seen})} разных адресов"
    )


def test_restored_receipt_keeps_the_paid_date(page: Page):
    """Чек, восстановленный по адресу, терял оплаченную дату, и «Открыть полный разбор» вёл на
    чужой, неоплаченный разбор."""
    mail = _mail("receipt")
    flows.buy(page, mail, 21, 6, 1966, sex="f")
    page.wait_for_timeout(800)
    paid = page.url
    assert "paid=" in paid, f"адрес чека без ?paid=: {paid}"

    page.goto(paid, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    link = page.get_by_role("link", name=re.compile("Открыть полный разбор"))
    assert link.count(), "на восстановленном чеке нет ссылки на разбор"
    href = link.first.get_attribute("href") or ""
    assert "m=" in href, f"ссылка ведёт на {href} — оплаченная дата потеряна"


def test_report_opens_the_paid_date(page: Page):
    """«Мой разбор» открывал последнюю сохранённую дату, а оплаченную было не найти вовсе."""
    mail = _mail("report")
    flows.buy(page, mail, 3, 11, 1978, sex="f")
    flows.calculate(page, 9, 2, 2001)
    flows.save_current(page)

    page.goto(f"{BASE}/report", wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    text = page.inner_text("main")
    links = page.locator("main a[href*='/report?m=']").count()
    assert "3 ноября 1978" in text or links, (
        "разбор открыт на неоплаченной дате, и перехода на оплаченную нет"
    )


def test_login_into_another_account_leaves_the_login_page(page: Page):
    """Вход при живой сессии проходил, но страница входа перерисовывала форму: выглядело как
    неудача, и человек жал «Войти» ещё раз."""
    first = _mail("sess1")
    second = _mail("sess2")
    flows.register(page, first)
    flows.logout(page)
    flows.register(page, second)

    page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    page.get_by_test_id("auth-email").fill(first)
    page.get_by_test_id("auth-password").fill("1234")
    page.get_by_test_id("auth-submit").click()
    page.wait_for_timeout(4000)
    assert page.url.rstrip("/").endswith("/account"), f"остались на {page.url}"


def test_logout_goes_to_the_home_page(page: Page):
    """«Выйти» перезагружало текущую страницу, и человек оставался на экране «Нужен вход»."""
    mail = _mail("out")
    flows.register(page, mail)
    page.goto(f"{BASE}/account", wait_until="domcontentloaded")
    page.wait_for_timeout(800)
    page.get_by_test_id("logout").click()
    page.wait_for_timeout(4000)
    assert re.fullmatch(r"https?://[^/]+/?", page.url), f"после выхода остались на {page.url}"


def test_unknown_matrix_in_pay_link_does_not_substitute_another(page: Page):
    """`?m=` с несуществующим номером молча вставлял в платёж другую дату."""
    mail = _mail("unknown")
    flows.register(page, mail)
    flows.calculate(page, 5, 12, 1994)
    flows.save_current(page)

    page.goto(f"{BASE}/pay?m=999999", wait_until="domcontentloaded")
    page.wait_for_selector("[data-testid=pay-submit]")
    page.wait_for_timeout(1500)
    picked = page.get_by_test_id("pay-target").input_value()
    assert picked == "none", f"неизвестный номер подставил цель {picked}"


@pytest.mark.parametrize("path", ("/matrices/abc", "/matrices/1e3", "/matrices/null"))
def test_broken_matrix_address_is_not_found(page: Page, path):
    """Нечисловой номер проваливался в «самую свежую матрицу»: адрес называл одну запись, а
    страница показывала другую."""
    mail = _mail("addr")
    flows.register(page, mail)
    flows.calculate(page, 5, 12, 1994)
    flows.save_current(page)

    res = page.request.get(f"{BASE}{path}")
    assert res.status == 404, f"{path}: код {res.status}"


def test_one_broken_admin_request_keeps_the_rest_of_the_screen(page: Page):
    """Отказ одного из четырёх запросов заменял всю админку экраном «Админка недоступна»."""
    flows.login(page, *ADMIN)
    page.route("**/api/admin/sweeps*", lambda route: route.abort())
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    page.wait_for_timeout(7000)
    assert "Админка недоступна" not in page.inner_text("main")
    assert page.get_by_test_id("admin-users").count(), "список пользователей исчез"


def test_security_log_error_clears_after_a_good_answer(page: Page):
    """Панель журнала оставляла «Сервер не отвечает» навсегда, хотя следующий ответ приходил."""
    flows.login(page, *ADMIN)
    calls = {"n": 0}

    def flaky(route):
        calls["n"] += 1
        if calls["n"] == 1:
            route.abort()
        else:
            route.continue_()

    page.route("**/api/admin/security-audit*", flaky)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)
    page.get_by_role("button", name="Успешные").first.click()
    page.wait_for_timeout(3000)
    panel = page.locator("[data-testid=admin-security-panel], .panel", has_text="Журнал безопасности").first
    assert "Сервер не отвечает" not in panel.inner_text(), "ошибка осталась после удачного ответа"


def test_pulse_says_it_lost_the_server(page: Page):
    """Панель «Состояние» молча замирала на старых числах, когда опрос переставал отвечать."""
    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    page.wait_for_selector("[data-testid=admin-pulse]", timeout=20_000)
    page.route("**/api/admin/pulse*", lambda route: route.abort())
    page.route("**/api/admin/errors*", lambda route: route.abort())
    page.wait_for_timeout(26_000)
    panel = page.locator("[data-testid=admin-pulse]").first
    assert re.search(r"не отвеча|устарел|связ", panel.inner_text(), re.I), (
        "панель не сообщает, что данные перестали обновляться"
    )
