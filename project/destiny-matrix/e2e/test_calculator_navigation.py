"""Переходы к калькулятору из энциклопедии не должны терять или прятать результат."""
from __future__ import annotations

import re

from playwright.sync_api import Page, expect

import flows
from conftest import BASE


POSITION = "/encyclopedia/position/character"


def _choose(page: Page, prefix: str = "", submit: str = "calc-submit") -> None:
    page.wait_for_selector(f'[data-testid="{submit}"]:not([disabled])', timeout=20_000)
    page.select_option(f"#{prefix}d", "7")
    page.select_option(f"#{prefix}m", "3")
    page.select_option(f"#{prefix}y", "1990")
    page.get_by_test_id(f"{prefix and 'promo-'}sex-m").click()
    page.get_by_test_id(submit).click()


def _expect_chosen_matrix(page: Page) -> None:
    result = page.locator("#result")
    expect(result).to_contain_text("7 марта 1990", timeout=20_000)
    expect(result).to_contain_text("Ваша матрица")


def test_position_calculate_link_then_home_form_shows_matrix(page: Page) -> None:
    page.goto(f"{BASE}{POSITION}", wait_until="domcontentloaded")
    page.get_by_role("link", name="Рассчитать матрицу", exact=True).click()
    page.wait_for_url(f"{BASE}/#calc")

    _choose(page)
    _expect_chosen_matrix(page)


def test_position_embedded_form_shows_matrix_on_home(page: Page) -> None:
    page.goto(f"{BASE}{POSITION}", wait_until="domcontentloaded")
    _choose(page, prefix="p", submit="promo-submit")
    page.wait_for_url(f"{BASE}/#result")

    _expect_chosen_matrix(page)


def test_position_top_calculator_shows_matrix_instead_of_only_a_link(page: Page) -> None:
    """Главная форма шапки энциклопедии не должна оставлять результат за вторым кликом."""
    page.goto(f"{BASE}{POSITION}", wait_until="domcontentloaded")
    _choose(page)
    page.wait_for_url(f"{BASE}/#result")

    _expect_chosen_matrix(page)


def test_position_calculator_opens_an_already_paid_report(page: Page, mail: str) -> None:
    """Одноразовый запрос расчёта переживает переход из энциклопедии на главную."""
    flows.buy(page, mail, 7, 3, 1990, sex="m")
    matrix_id = flows.matrix_ids(page)[0]

    page.goto(f"{BASE}{POSITION}", wait_until="domcontentloaded")
    _choose(page, prefix="p", submit="promo-submit")

    page.wait_for_url(re.compile(rf"/\?m={matrix_id}#result$"), timeout=20_000)
    expect(page.locator("main")).to_contain_text("7 марта 1990")
    assert flows.locked_sections(page) == 0
