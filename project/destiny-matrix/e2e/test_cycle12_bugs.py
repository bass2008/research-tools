"""Цикл 12, ступень 1: толкование позиции одно на весь сайт."""
from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from conftest import BASE

pytestmark = pytest.mark.bug


def test_section_article_links_to_its_exact_points_instead_of_generic_arcana_cards(page: Page):
    """Раздел из нескольких точек не должен выдавать общий текст раздела за трактовку точки."""
    page.goto(f"{BASE}/encyclopedia/position/character", wait_until="domcontentloaded")

    expect(page.get_by_role("heading", name="Позиции этого раздела")).to_be_visible()
    for key in ("day", "month", "year"):
        expect(page.locator(f'a[href="/ru/encyclopedia/position/{key}"]')).to_be_visible()
    expect(page.get_by_role("heading", name="Все 22 аркана в этой позиции")).to_have_count(0)

    page.goto(f"{BASE}/encyclopedia/position/day", wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name="Все 22 аркана в этой позиции")).to_be_visible()
