"""Регрессии двух дефектов вёрстки, найденных перед единым релизом."""
from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page

import flows
from conftest import BASE

pytestmark = pytest.mark.bug


@pytest.mark.parametrize(
    "width,path",
    (
        (320, "/encyclopedia/combination/1-2"),
        (320, "/encyclopedia/karmic-tail/6-14-8"),
        (320, "/na-god/2026"),
        (360, "/na-god/11"),
        (390, "/na-god/2026"),
    ),
)
def test_active_encyclopedia_category_is_fully_visible(page: Page, width: int, path: str):
    page.set_viewport_size({"width": width, "height": 780})
    page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
    page.wait_for_selector(".enc-navi.on")
    page.wait_for_timeout(500)

    geometry = page.evaluate(
        """() => {
          const nav = document.querySelector('.enc-nav').getBoundingClientRect();
          const active = document.querySelector('.enc-navi.on').getBoundingClientRect();
          return {navLeft: nav.left, navRight: nav.right,
                  activeLeft: active.left, activeRight: active.right};
        }"""
    )
    assert geometry["activeLeft"] >= geometry["navLeft"] - 1, geometry
    assert geometry["activeRight"] <= geometry["navRight"] + 1, geometry


@pytest.mark.parametrize("width", (320, 768, 1360))
def test_recalculated_paid_result_stops_below_sticky_header(
    page: Page, mail: str, width: int,
):
    day, month, year = 2, 2, 1992
    assert not flows.buy(page, mail, day, month, year)

    page.set_viewport_size({"width": width, "height": 780})
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])')
    page.select_option("#d", str(day))
    page.select_option("#m", str(month))
    page.select_option("#y", str(year))
    page.get_by_test_id("sex-m").click()
    page.get_by_test_id("calc-submit").click()
    page.wait_for_url(re.compile(r"/\?m=\d+#result"), timeout=20_000)
    page.wait_for_timeout(3000)

    geometry = page.evaluate(
        """() => {
          const header = document.querySelector('.site-header').getBoundingClientRect();
          const result = document.querySelector('#result').getBoundingClientRect();
          return {headerBottom: header.bottom, resultTop: result.top};
        }"""
    )
    assert geometry["resultTop"] >= geometry["headerBottom"] - 1, geometry
