"""Цикл 10, ступень 1: доступность, навигация и состояние между вкладками. Раунд 5."""
from __future__ import annotations

import re
import uuid

import pytest
from playwright.sync_api import Page

import flows
from conftest import BASE

pytestmark = pytest.mark.bug


def test_landing_has_a_main_landmark(page: Page):
    """На главной не было <main>: скринридер не мог перейти к содержимому одной командой."""
    page.goto(BASE, wait_until="domcontentloaded")
    assert page.locator("main#content").count() == 1


def test_skip_link_leads_to_the_content(page: Page):
    """До текста статьи было 35 нажатий Tab, ссылки «к содержимому» не существовало."""
    page.goto(f"{BASE}/encyclopedia/arcanum/7", wait_until="domcontentloaded")
    page.keyboard.press("Tab")
    focused = page.evaluate("() => document.activeElement?.getAttribute('href')")
    assert focused == "#content", f"первый Tab ведёт на {focused}"


def test_sex_buttons_announce_the_choice(page: Page):
    """Выбранный пол отличался только цветом фона: состояние не читалось вслух."""
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])')
    page.get_by_test_id("sex-f").click()
    assert page.get_by_test_id("sex-f").get_attribute("aria-pressed") == "true"
    assert page.get_by_test_id("sex-m").get_attribute("aria-pressed") == "false"


def test_tabs_move_with_arrow_keys(page: Page):
    """role=tab обещал клавиатурное поведение, которого не было: стрелки не работали."""
    page.goto(f"{BASE}/encyclopedia/arcanum/7", wait_until="domcontentloaded")
    page.wait_for_selector(".tab")
    first = page.locator(".tab").first
    first.focus()
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(800)
    active = page.evaluate("() => document.querySelector('.tab.on')?.textContent?.trim()")
    assert active and "Значение" not in active, f"после стрелки активна вкладка «{active}»"
    panels = page.locator("[role=tabpanel]").count()
    assert panels >= 2, f"панелей вкладок: {panels}"


def test_form_errors_are_announced(page: Page):
    """Сообщение об отказе выводилось без role/aria-live: читалка о нём молчала."""
    page.goto(f"{BASE}/register", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="auth-submit"]:not([disabled])')
    page.get_by_test_id("auth-email").fill(f"a11y-{uuid.uuid4().hex[:6]}@example.com")
    page.get_by_test_id("auth-password").fill("secret1")
    page.get_by_test_id("auth-submit").click()
    err = page.locator(".err[role=alert]")
    assert err.count(), "у сообщения нет role=alert"


def test_header_navigation_survives_narrow_screens(page: Page):
    """На ≤980 px навигация просто исчезала, замены не было: со страницы разбора было
    некуда уйти."""
    page.set_viewport_size({"width": 700, "height": 900})
    page.goto(f"{BASE}/report", wait_until="domcontentloaded")
    page.wait_for_timeout(600)
    links = page.locator(".hnav a").count()
    visible = page.locator(".hnav a:visible").count()
    assert links and visible == links, f"видно {visible} из {links} ссылок шапки"


@pytest.mark.parametrize(
    "label,expect",
    (("Позиции карты", "Позиции карты"), ("22 аркана", "22 аркана")),
)
def test_hero_buttons_open_what_they_promise(page: Page, label, expect):
    """Кнопка «22 аркана» открывала страницу одного аркана, «Позиции карты» — список арканов."""
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector(".slide")
    href = page.evaluate(
        """(label) => {
          const link = [...document.querySelectorAll('.slide a')].find(a => a.textContent.trim() === label);
          return link ? link.getAttribute('href') : null;
        }""",
        label,
    )
    assert href, f"кнопки «{label}» нет на слайдах"
    page.goto(BASE + href, wait_until="domcontentloaded")
    page.wait_for_timeout(900)
    section = page.evaluate(
        """() => {
          const pane = [...document.querySelectorAll('.enc-pane')]
            .find(e => getComputedStyle(e).display !== 'none');
          return pane ? pane.querySelector('h2')?.textContent?.trim() : null;
        }"""
    )
    assert section == expect, f"«{label}» открыла раздел «{section}»"


def test_encyclopedia_slides_do_not_repeat_one_button(page: Page):
    """На /encyclopedia три слайда из пяти показывали одну и ту же кнопку «Каталог матриц»."""
    page.goto(f"{BASE}/encyclopedia", wait_until="domcontentloaded")
    page.wait_for_selector(".slide")
    labels = page.evaluate(
        """() => [...document.querySelectorAll('.slide .btnrow a.ghost')].map(a => a.textContent.trim())"""
    )
    assert len(labels) == len(set(labels)), f"кнопки повторяются: {labels}"


def test_positions_link_opens_positions(page: Page):
    """«Все позиции» на странице позиции открывало список арканов."""
    page.goto(f"{BASE}/encyclopedia/position/center", wait_until="domcontentloaded")
    page.wait_for_timeout(500)
    href = page.evaluate(
        """() => {
          const link = [...document.querySelectorAll('a')].find(a => /Все позиции/.test(a.textContent));
          return link ? link.getAttribute('href') : null;
        }"""
    )
    assert href and "sec=pts" in href, f"ссылка ведёт на {href}"


def test_report_does_not_offer_login_to_a_signed_in_person(page: Page):
    """Вошедшему предлагали «Уже оплачивали? Войдите» — читалось как «мы вас не узнали»."""
    mail = f"agent-rep-{uuid.uuid4().hex[:8]}@example.com"
    flows.register(page, mail)
    flows.calculate(page, 19, 3, 1987)
    page.goto(f"{BASE}/report", wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    text = page.inner_text("main")
    assert "Уже оплачивали" not in text, "вошедшему предлагают войти"
