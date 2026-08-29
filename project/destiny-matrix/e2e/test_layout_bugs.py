"""Регрессии каркаса и адаптивной вёрстки."""
from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import Page

import flows
from conftest import BASE

pytestmark = pytest.mark.bug


def test_global_404_keeps_the_site_header_and_footer(page: Page):
    response = page.goto(f"{BASE}/net-takoy-stranicy", wait_until="domcontentloaded")
    assert response and response.status == 404
    assert page.locator("header.site-header").count() == 1
    assert page.locator("footer.site-footer").count() == 1


@pytest.mark.parametrize("width", (320, 768, 1360))
def test_result_stops_below_the_sticky_header(page: Page, width: int):
    page.set_viewport_size({"width": width, "height": 780})
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])')
    page.select_option("#d", "11")
    page.select_option("#m", "3")
    page.select_option("#y", "1990")
    page.get_by_test_id("sex-m").click()
    page.get_by_test_id("calc-submit").click()
    page.wait_for_timeout(1200)

    geometry = page.evaluate(
        """() => {
          const header = document.querySelector('.site-header').getBoundingClientRect();
          const result = document.querySelector('#result').getBoundingClientRect();
          return { headerBottom: header.bottom, resultTop: result.top };
        }"""
    )
    assert geometry["resultTop"] >= geometry["headerBottom"] - 1, geometry


def test_paid_report_has_one_bottom_navigation_row(page: Page):
    mail = f"layout-{uuid.uuid4().hex[:10]}@example.com"
    assert not flows.buy(page, mail, 11, 3, 1990)

    page.goto(f"{BASE}/report", wait_until="domcontentloaded")
    page.wait_for_timeout(700)
    rows = page.locator("main > .wrap > p.small").all_inner_texts()
    assert rows == ["Кабинет · Новый расчёт · Энциклопедия"]

    matrix_id = flows.matrix_ids(page)[0]
    page.goto(f"{BASE}/matrices/{matrix_id}", wait_until="domcontentloaded")
    rows = page.locator("main > .wrap > p.small").all_inner_texts()
    assert rows == ["Кабинет · Новый расчёт · Мой разбор"]


def test_positions_table_fits_a_320px_screen_with_justice(page: Page):
    page.set_viewport_size({"width": 320, "height": 780})
    flows.calculate(page, 11, 3, 1990)
    sizes = page.locator("#result .tabscroll").evaluate(
        "el => ({ client: el.clientWidth, scroll: el.scrollWidth })"
    )
    assert sizes["scroll"] <= sizes["client"] + 1, sizes
