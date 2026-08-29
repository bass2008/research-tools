"""Цикл 7, ступень 1: навигация каркаса справочника, оплата и кабинет.

Тесты написаны до правок и падали по существу дефекта.
"""

import re
import uuid

import pytest
from playwright.sync_api import Page

import flows
from conftest import BASE

pytestmark = pytest.mark.bug


def _section(page: Page) -> str:
    return page.evaluate(
        """() => {
          const pane = [...document.querySelectorAll('.enc-pane')]
            .find(e => getComputedStyle(e).display !== 'none');
          return pane ? pane.querySelector('h2').textContent.trim() : null;
        }"""
    )


@pytest.mark.parametrize(
    "path,expected",
    (
        ("/encyclopedia?sec=cmb", "Сочетания арканов"),
        ("/encyclopedia?sec=tls", "Кармические хвосты"),
        ("/encyclopedia?sec=art", "Статьи"),
    ),
)
def test_section_link_opens_the_section_it_names(page: Page, path, expected):
    """Крошки, кнопки слайдов и шапка вели на ?sec=…, а каркас читал только якорь — открывались
    всегда «22 аркана»."""
    page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
    page.wait_for_selector(".enc-navi")
    page.wait_for_timeout(500)
    assert _section(page) == expected, f"{path}: открыт раздел «{_section(page)}»"


def test_crumb_from_detail_page_opens_its_section(page: Page):
    """Из аркана крошка «22 аркана» обязана открывать список арканов, а не другой раздел."""
    page.goto(f"{BASE}/encyclopedia/arcanum/7", wait_until="domcontentloaded")
    page.wait_for_selector(".enc-crumbs")
    page.get_by_role("link", name="22 аркана").first.click()
    page.wait_for_url("**/encyclopedia**")
    page.wait_for_timeout(700)
    assert _section(page) == "22 аркана", f"крошка открыла «{_section(page)}»"


def test_back_from_detail_page_shows_the_list_again(page: Page):
    """«Назад» с детальной страницы возвращал адрес раздела, а на экране оставалась статья."""
    page.goto(f"{BASE}/encyclopedia?sec=chk", wait_until="domcontentloaded")
    page.wait_for_selector(".enc-navi")
    page.wait_for_timeout(400)
    page.locator(".chcol a").first.click()
    page.wait_for_url("**/encyclopedia/chakra/**")
    page.go_back()
    page.wait_for_timeout(900)
    assert page.locator(".enc-panes").count(), "после возврата нет рабочей области справочника"
    assert _section(page) == "Семь чакр", f"после возврата открыт «{_section(page)}»"


@pytest.mark.parametrize("width", (390, 1440))
def test_opening_a_section_does_not_scroll_the_page_away(page: Page, width):
    """Якорь раздела заставлял браузер прокручивать страницу вниз и срезал первый экран."""
    page.set_viewport_size({"width": width, "height": 800})
    page.goto(f"{BASE}/encyclopedia?sec=yer", wait_until="domcontentloaded")
    page.wait_for_selector(".enc-navi")
    page.wait_for_timeout(900)
    top = page.evaluate("() => Math.round(window.scrollY)")
    assert top < 60, f"страница сама уехала вниз на {top} px"


def _register(page: Page, mail: str) -> None:
    page.goto(f"{BASE}/register", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="auth-email"]')
    page.get_by_test_id("auth-email").fill(mail)
    page.get_by_test_id("auth-password").fill("test-pass-123")
    page.locator('input[type="checkbox"]').first.check()
    page.get_by_test_id("auth-submit").click()
    page.wait_for_timeout(1200)


def test_receipt_survives_reload_on_its_own_address(page: Page):
    """Адрес чека /pay?paid=<id> после F5 показывал форму покупки: человек терял подтверждение
    оплаты и видел кнопку «Оплатить» на другую дату."""
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])')
    page.select_option("#d", "9")
    page.select_option("#m", "9")
    page.select_option("#y", "1979")
    page.get_by_test_id("calc-submit").click()
    page.wait_for_timeout(900)

    page.goto(f"{BASE}/pay", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="pay-submit"]')
    page.get_by_test_id("pay-email").fill(f"agent-receipt-{uuid.uuid4().hex[:8]}@example.com")
    page.get_by_test_id("pay-password").fill("test-pass-123")
    page.locator('input[type="checkbox"]').first.check()
    page.get_by_test_id("pay-submit").click()
    page.wait_for_url("**paid=**", timeout=30000)
    page.wait_for_timeout(1200)
    assert page.get_by_role("heading", name="Доступ открыт").count(), "после оплаты нет чека"

    url = page.url
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    assert page.get_by_role("heading", name="Доступ открыт").count(), (
        f"после обновления {url} чек пропал и вместо него форма покупки"
    )


def test_account_does_not_offer_to_save_a_date_it_already_has(page: Page):
    """Кабинет предлагал сохранить дату, которая уже лежит в списке: кнопка ничего не делала."""
    mail = f"agent-acc-{uuid.uuid4().hex[:8]}@example.com"
    _register(page, mail)
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])')
    page.select_option("#d", "4")
    page.select_option("#m", "4")
    page.select_option("#y", "1984")
    page.get_by_test_id("calc-submit").click()
    page.wait_for_timeout(900)

    page.goto(f"{BASE}/account", wait_until="domcontentloaded")
    page.wait_for_timeout(1200)
    save = page.get_by_test_id("save-matrix")
    if save.count():
        save.first.click()
        page.wait_for_timeout(1500)

    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    rows = page.locator(".slot, .matrix-row, [data-testid='saved-row']").count()
    still = page.get_by_test_id("save-matrix").count()
    assert not still, (
        f"кабинет снова предлагает сохранить уже сохранённую дату (строк в списке: {rows})"
    )


def test_locked_report_does_not_offer_pdf(page: Page):
    """Кнопка «Сохранить как PDF» стояла и на закрытом разборе: нажатие всегда отвечало
    «Разбор этой даты не оплачен» — обещание, которого страница не выполняет."""
    mail = f"agent-pdf-{uuid.uuid4().hex[:8]}@example.com"
    _register(page, mail)
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])')
    page.select_option("#d", "6")
    page.select_option("#m", "6")
    page.select_option("#y", "1986")
    page.get_by_test_id("calc-submit").click()
    page.wait_for_timeout(1000)

    page.goto(f"{BASE}/report", wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    # признак закрытого разбора — блок предложения купить остальные разделы
    assert page.locator(".allbox").count(), "разбор оказался открытым: случай не про этот тест"
    assert page.get_by_test_id("save-pdf").count() == 0, (
        "на закрытом разборе стоит кнопка PDF, которая всегда отвечает отказом"
    )


def test_pay_link_to_an_open_matrix_does_not_swap_the_date(page: Page):
    """`/pay?m=<id>` на уже оплаченную дату молча подставлял другую: список целей содержит только
    закрытые записи, и цель падала на первую из них. Человек платил не за ту дату."""
    mail = f"agent-swap-{uuid.uuid4().hex[:8]}@example.com"
    flows.buy(page, mail, 9, 9, 1979)  # первая дата: оплачена и попала в кабинет сама

    flows.calculate(page, 3, 3, 1993)  # вторая дата: только сохранена, закрыта
    flows.save_current(page)

    ids = flows.matrix_ids(page)
    assert len(ids) >= 2, f"в кабинете {len(ids)} матриц — случай не собран"
    open_id = min(ids)  # оплаченная сохранена первой

    page.goto(f"{BASE}/pay?m={open_id}", wait_until="domcontentloaded")
    page.wait_for_selector("[data-testid=pay-submit]")
    page.wait_for_timeout(1200)
    picked = page.get_by_test_id("pay-target").input_value()
    assert picked in (None, "none"), (
        f"ссылка на открытую матрицу {open_id} выбрала другую цель: {picked}"
    )
    assert page.get_by_test_id("pay-open-note").count(), (
        "нет объяснения, что эта дата уже открыта"
    )


@pytest.mark.parametrize(
    "path",
    ("/nope", "/encyclopedia/arcanum/99", "/encyclopedia/chakra/nope", "/matrix/9-9-9999"),
)
def test_not_found_page_comes_with_the_html(page: Page, path):
    """404 отдавался пустой оболочкой: заголовок и текст приходили только RSC-пейлоадом, а в
    <head> стоял заголовок главной. Без скриптов страница была пустой."""
    body = page.request.get(f"{BASE}{path}")
    assert body.status == 404, f"{path}: код {body.status}"
    html = body.text()
    head = re.search(r"<title>([^<]*)</title>", html)
    assert head and "не найдена" in head.group(1), f"{path}: заголовок вкладки «{head and head.group(1)}»"
    without_scripts = re.sub(r"<script.*?</script>", "", html, flags=re.S)
    assert "Такой страницы нет" in without_scripts, f"{path}: тела 404 в разметке нет"
