"""Действия админа над чужим аккаунтом через интерфейс: войти под ним, выдать матрицу, забрать PDF.

Появились после первой живой покупки: проверить жалобу словами покупателя нечем, если не видеть
сайт его глазами.
"""
from __future__ import annotations

import urllib.parse

import flows
from conftest import ADMIN, BASE
from playwright.sync_api import expect


def open_actions(page, mail: str):
    """Меню действий в строке пользователя.

    Сам список живёт в `body`, а не в строке: обёртка таблицы прокручивает содержимое и обрезала
    выпадашку нижней границей. Поэтому пункты ищем на странице, а строку возвращаем для кнопки и
    сообщений, которые остаются в ней.
    """
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    row = page.locator("[data-testid=admin-user-row]", has_text=mail).first
    expect(row).to_be_visible(timeout=20_000)
    row.get_by_test_id("user-actions").click()
    return row


def test_admin_enters_as_the_user_and_sees_his_account(page, mail):
    """Имперсонация: админ нажимает «Войти» и оказывается в кабинете покупателя, а не в своём."""
    flows.buy(page, mail, 7, 7, 1997)
    flows.logout(page)
    flows.login(page, *ADMIN)

    row = open_actions(page, mail)
    asked: list[str] = []
    page.once("dialog", lambda d: (asked.append(d.message), d.accept()))
    page.get_by_test_id("action-impersonate").click()

    page.wait_for_url(f"{BASE}/account", timeout=30_000)
    page.wait_for_timeout(800)
    assert asked and mail in asked[0], f"вход под чужим аккаунтом не спросил подтверждения: {asked}"
    assert mail in page.inner_text("body"), "кабинет открылся не под тем пользователем"
    # Админка под его сессией недоступна: права проверяет апстрим, а не спрятанная ссылка.
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    expect(page.get_by_test_id("admin-users")).to_have_count(0, timeout=20_000)


def test_impersonation_lands_in_the_security_log(page, mail):
    """Вход под чужим аккаунтом обязан быть виден в журнале и отличаться от обычного входа."""
    flows.buy(page, mail, 8, 8, 1988)
    flows.logout(page)
    flows.login(page, *ADMIN)

    row = open_actions(page, mail)
    page.once("dialog", lambda d: d.accept())
    page.get_by_test_id("action-impersonate").click()
    page.wait_for_url(f"{BASE}/account", timeout=30_000)

    flows.logout(page)
    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="networkidle")
    audit = page.get_by_test_id("admin-security-audit")
    expect(audit).to_contain_text("имперсонированный вход", timeout=20_000)
    expect(audit).to_contain_text(mail)


def test_admin_grants_a_matrix_and_it_is_open_but_not_bought(page, mail):
    """Выданная матрица открыта, но помечена иначе, чем купленная: подарок — не покупка."""
    flows.buy(page, mail, 9, 9, 1999)
    flows.logout(page)
    flows.login(page, *ADMIN)

    row = open_actions(page, mail)
    page.get_by_test_id("action-grant").click()
    dialog = page.get_by_test_id("grant-dialog")
    expect(dialog).to_be_visible()
    dialog.get_by_test_id("grant-day").select_option("17")
    dialog.get_by_test_id("grant-month").select_option("3")
    dialog.get_by_test_id("grant-year").select_option("1984")
    dialog.get_by_test_id("grant-sex-m").click()
    dialog.get_by_test_id("grant-submit").click()
    expect(row.get_by_test_id("grant-done")).to_be_visible(timeout=20_000)

    flows.logout(page)
    flows.login(page, mail)
    page.goto(f"{BASE}/account", wait_until="networkidle")
    page.wait_for_timeout(800)
    body = page.inner_text("main")
    assert "17 марта 1984" in body, f"выданной даты нет в кабинете: {body[:200]}"
    granted = page.locator(".matrow", has_text="17 марта 1984").first
    assert "открыта" in granted.inner_text().lower(), granted.inner_text()
    assert "куплена" not in granted.inner_text().lower(), \
        f"подарок выглядит купленным: {granted.inner_text()}"
    # у купленной метка остаётся прежней — две строки в списке не должны слиться в одну
    bought = page.locator(".matrow", has_text="9 сентября 1999").first
    assert "куплена" in bought.inner_text().lower(), bought.inner_text()


def test_admin_downloads_any_report(page, mail):
    """Кнопка «Скачать» у готовой печати отдаёт подписанную ссылку на чужой файл."""
    flows.buy(page, mail, 13, 12, 1994)
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(1200)
    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)
    with page.expect_response(
        lambda r: r.url.endswith("/api/reports/pdf") and r.status == 200, timeout=180_000
    ):
        button.click()

    flows.logout(page)
    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="networkidle")
    row = page.locator("[data-testid=admin-report-row]", has_text=mail).first
    expect(row).to_be_visible(timeout=20_000)

    # Проверяем ответ, а не адрес открытой вкладки: window.open создаёт её пустой, и адрес
    # появляется там позже — гонка, из-за которой проверка «.pdf в url» ловила пустую строку.
    with page.expect_response(
        lambda r: "/api/admin/report-link" in r.url and r.status == 200, timeout=30_000
    ) as answer:
        row.get_by_test_id("report-download").click()
    # Проверяем сам файл, а не вид ссылки: у Object Storage ключ и имя видны в адресе, у
    # локального хранилища стендов они спрятаны в подписанном пропуске. Обещание же не в том,
    # как выглядит ссылка, а в том, что по ней приезжает разбор с датой в имени.
    url = answer.value.json()["url"]
    file = page.request.get(url)
    assert file.status == 200, f"скачивание отчёта отдало {file.status}: {url}"
    assert file.body().startswith(b"%PDF"), "по ссылке приехал не PDF"
    assert "13 декабря 1994" in urllib.parse.unquote(
        file.headers.get("content-disposition", "")), "в заголовке нет даты разбора"


def test_dialog_closes_by_escape_and_by_click_outside(page, mail):
    """Модалка обязана закрываться привычными способами: Escape и клик мимо."""
    flows.buy(page, mail, 5, 5, 1995)
    flows.logout(page)
    flows.login(page, *ADMIN)

    row = open_actions(page, mail)
    page.get_by_test_id("action-grant").click()
    expect(page.get_by_test_id("grant-dialog")).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.get_by_test_id("grant-dialog")).to_have_count(0, timeout=5_000)

    row.get_by_test_id("user-actions").click()
    page.get_by_test_id("action-grant").click()
    expect(page.get_by_test_id("grant-dialog")).to_be_visible()
    page.mouse.click(80, 700)
    expect(page.get_by_test_id("grant-dialog")).to_have_count(0, timeout=5_000)
