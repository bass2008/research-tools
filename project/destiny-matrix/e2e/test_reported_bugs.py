"""Регрессии из итогового аудита: точная дата оплаты, навигация и состояния форм."""
from __future__ import annotations

import re
import uuid

import pytest
from playwright.sync_api import Browser, Page, expect

import flows
from conftest import ADMIN, BASE, _credentials

pytestmark = pytest.mark.bug


def _mail(tag: str) -> str:
    return f"reported-{tag}-{uuid.uuid4().hex[:10]}@example.com"


def _refund_for(page: Page, mail: str) -> None:
    flows.logout(page)
    flows.login(page, *ADMIN)
    rows = page.request.get(f"{BASE}/api/admin/payments").json()["items"]
    payment = next(row for row in rows if row["email"] == mail and row["state"] == "paid")
    answer = page.request.post(f"{BASE}/api/admin/payments/{payment['id']}/refund")
    assert answer.ok, answer.text()
    flows.logout(page)


def test_registration_replaces_the_form_in_browser_history(page: Page):
    """Назад после регистрации ведёт на предыдущую страницу, а не на уже недействительную форму."""
    page.goto(BASE, wait_until="domcontentloaded")
    page.get_by_test_id("nav-register").click()
    page.get_by_test_id("auth-email").fill(_mail("history"))
    page.get_by_test_id("auth-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    page.wait_for_url(f"{BASE}/account")

    page.go_back(wait_until="domcontentloaded")
    assert not page.url.rstrip("/").endswith("/register"), page.url
    assert page.get_by_test_id("auth-submit").count() == 0


def test_failed_auth_returns_focus_to_an_editable_field(page: Page):
    """role=alert объявляет ошибку скринридеру, но клавиатура остаётся в исправляемом поле."""
    known = _mail("focus")
    flows.register(page, known)
    flows.logout(page)

    page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    page.get_by_test_id("auth-email").fill(known)
    password = page.get_by_test_id("auth-password")
    password.fill("wrong")
    page.get_by_test_id("auth-submit").click()
    expect(page.locator(".err")).to_be_visible()
    assert page.evaluate("document.activeElement?.id") == "password"
    password.press("End")
    page.keyboard.type("x")
    assert password.input_value().endswith("x")

    page.goto(f"{BASE}/register", wait_until="domcontentloaded")
    email = page.get_by_test_id("auth-email")
    email.fill(known)
    page.get_by_test_id("auth-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    expect(page.locator(".err")).to_be_visible()
    assert page.evaluate("document.activeElement?.id") == "email"


def test_account_report_works_without_browser_birth_and_uses_free_wording(page: Page):
    """Ссылка кабинета открывает сохранённый id даже после очистки sessionStorage; закрытый
    разбор не называет бесплатный доступ «вашим тарифом»."""
    mail = _mail("clean")
    flows.register(page, mail)
    flows.calculate(page, 14, 6, 1987, sex="f")
    flows.save_current(page)

    page.evaluate("sessionStorage.clear()")
    page.goto(f"{BASE}/account", wait_until="domcontentloaded")
    report = page.get_by_test_id("account-report")
    expect(report).to_be_visible()
    href = report.get_attribute("href") or ""
    assert re.fullmatch(r"/matrices/\d+", href), href
    report.click()
    page.wait_for_url(re.compile(r"/matrices/\d+$"))

    text = page.inner_text("main").lower()
    assert "дата не выбрана" not in text
    assert "ваш тариф" not in text
    assert "бесплатный доступ" in text


def test_refunded_twin_dates_keep_the_exact_payment_target(page: Page):
    """После возврата две закрытые карты одной даты различаются полом, а кнопка под текущим
    бесплатным разбором несёт id именно этой карты до кнопки и чека."""
    mail = _mail("twins")
    flows.buy(page, mail, 5, 5, 1985, sex="f")
    female_id = flows.matrix_ids(page)[0]
    flows.calculate(page, 5, 5, 1985, sex="m")
    flows.save_current(page)
    assert len(flows.matrix_ids(page)) == 2

    _refund_for(page, mail)
    flows.login(page, mail)
    flows.calculate(page, 5, 5, 1985, sex="f")
    page.goto(f"{BASE}/report", wait_until="domcontentloaded")
    buy = page.get_by_test_id("unlock-cta")
    expect(buy).to_be_visible()
    assert buy.get_attribute("href") == f"/pay?m={female_id}"

    buy.click()
    page.wait_for_url(re.compile(rf"/pay\?m={female_id}$"))
    expect(page.get_by_test_id("pay-target")).to_have_value(str(female_id))
    option_texts = page.get_by_test_id("pay-target").locator("option").all_inner_texts()
    assert any("(ж)" in text for text in option_texts), option_texts
    assert any("(м)" in text for text in option_texts), option_texts
    expect(page.get_by_test_id("pay-submit")).to_contain_text("(ж)")

    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    expect(page.get_by_test_id("paid-matrix")).to_be_visible(timeout=30_000)
    assert "женская" in page.get_by_test_id("paid-matrix").inner_text().lower()


def test_recalculating_a_paid_date_opens_it_on_the_landing(page: Page, browser: Browser):
    """Повторный расчёт купленной даты открывает её полный разбор прямо на главной.

    Раньше главная снова печатала два бесплатных раздела и 18 замков, хотя ниже сама же
    признавала оплату. Уводить человека на отдельный экран «Мой разбор» тоже не надо. При
    нескольких покупках нельзя просто открыть первую доступную дату.
    """
    mail = _mail("paid-landing")
    flows.buy(page, mail, 31, 3, 1993, sex="m")
    first = flows.matrix_ids(page)[0]
    flows.calculate(page, 9, 9, 1999, sex="f")
    flows.open_pay(page)
    assert not flows.pay(page, mail)

    page.goto(BASE, wait_until="domcontentloaded")
    assert page.locator('a[href="/#plans"]').count() >= 5

    flows.calculate(page, 31, 3, 1993, sex="m")
    page.wait_for_url(re.compile(rf"/\?m={first}#result$"), timeout=15_000)
    expect(page.locator("main")).to_contain_text("31 марта 1993")
    assert flows.locked_sections(page) == 0
    expect(page.get_by_role("link", name="Перейти к полному разбору").first).to_have_attribute(
        "href", "#result"
    )

    # Один id в адресе не раскрывает ни дату, ни платные тексты без куки владельца.
    guest_context = browser.new_context(locale="ru-RU", http_credentials=_credentials())
    guest = guest_context.new_page()
    try:
        guest.goto(f"{BASE}/?m={first}", wait_until="networkidle")
        assert "31 марта 1993" not in guest.inner_text("main")
        assert guest.get_by_test_id("save-pdf").count() == 0
    finally:
        guest_context.close()

    # С главной с открытым отчётом можно посчитать новую неоплаченную дату: старый ?m= обязан
    # исчезнуть, иначе сервер продолжит печатать предыдущую купленную матрицу.
    page.select_option("#d", "8")
    page.select_option("#m", "8")
    page.select_option("#y", "1978")
    page.get_by_test_id("sex-f").click()
    page.get_by_test_id("calc-submit").click()
    page.wait_for_url(f"{BASE}/#result", timeout=15_000)
    expect(page.locator("#result")).to_contain_text("8 августа 1978")
    assert flows.locked_sections(page) == 18


def test_refund_refreshes_users_and_payments_from_the_same_moment(page: Page, browser: Browser):
    """Платёж, пришедший после открытия админки, появляется после возврата вместе с покупателем."""
    first = _mail("admin-first")
    second = _mail("admin-second")
    flows.buy(page, first, 7, 7, 1987)
    flows.logout(page)
    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    old = page.locator("[data-testid=admin-payment-row]", has_text=first).first
    expect(old).to_be_visible(timeout=20_000)

    context = browser.new_context(locale="ru-RU", http_credentials=_credentials())
    buyer = context.new_page()
    try:
        assert not flows.buy(buyer, second, 8, 8, 1988)
    finally:
        context.close()

    page.once("dialog", lambda dialog: dialog.accept())
    old.get_by_test_id("refund").click()
    expect(old).to_contain_text("возвращён", timeout=30_000)
    fresh = page.locator("[data-testid=admin-payment-row]", has_text=second)
    expect(fresh).to_be_visible(timeout=30_000)


def test_pay_link_shows_loading_before_it_decides_the_date_is_missing(page: Page):
    """Медленный список матриц даёт честное состояние проверки, а не мгновенный ложный отказ."""
    mail = _mail("pay-loading")
    flows.register(page, mail)
    flows.calculate(page, 12, 4, 1992)
    flows.save_current(page)
    matrix_id = flows.matrix_ids(page)[0]

    pending = []

    def hold(route):
        if route.request.url.rstrip("/").endswith("/api/matrices"):
            pending.append(route)
            return
        route.continue_()

    page.route("**/api/matrices*", hold)
    page.goto(f"{BASE}/pay?m={matrix_id}", wait_until="domcontentloaded")
    expect(page.get_by_test_id("pay-target-loading")).to_be_visible(timeout=10_000)
    assert page.get_by_test_id("pay-missing-note").count() == 0
    assert page.get_by_test_id("pay-submit").is_disabled()
    for _ in range(50):
        if pending:
            break
        page.wait_for_timeout(100)
    assert pending, "запрос списка матриц не был задержан"

    pending[0].continue_()
    expect(page.get_by_test_id("pay-target")).to_have_value(str(matrix_id), timeout=15_000)
    assert page.get_by_test_id("pay-missing-note").count() == 0
