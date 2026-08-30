"""Цикл 12, ступень 1: толкование позиции одно на весь сайт."""
from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

from conftest import BASE

pytestmark = pytest.mark.bug

# Позиции имеют разные арканы, поэтому подмена общего текста раздела видна.
SLUG = "1-1-2"


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _position_text(page: Page, label: str) -> str:
    li = page.locator(".poslist li", has_text=label).first
    li.wait_for()
    body = _norm(li.inner_text())
    assert " — " in body, f"строка «{label}» без толкования: «{body}»"
    return body.split(" — ", 1)[1]


@pytest.mark.parametrize(
    "label,key",
    [
        ("Вход линии отношений и хвоста", "comfort_south"),
        ("Внутренняя точка таланта", "comfort_north"),
        ("Центр карты", "center"),
        ("Материальная задача", "year"),
    ],
)
def test_matrix_page_prints_the_text_of_the_position(page: Page, label: str, key: str):
    """Страница матрицы печатала общий пул раздела вместо текста конкретной позиции."""
    page.goto(f"{BASE}/matrix/{SLUG}", wait_until="domcontentloaded")
    text = _position_text(page, label)

    page.goto(f"{BASE}/encyclopedia/position/{key}", wait_until="domcontentloaded")
    reference = _norm(page.inner_text("main"))
    assert text in reference, (
        f"толкование «{label}» на /matrix/{SLUG} не совпадает с позицией {key}: «{text}»"
    )


def test_section_article_links_to_its_exact_points_instead_of_generic_arcana_cards(page: Page):
    """Раздел из нескольких точек не должен выдавать общий текст раздела за трактовку точки."""
    page.goto(f"{BASE}/encyclopedia/position/character", wait_until="domcontentloaded")

    expect(page.get_by_role("heading", name="Позиции этого раздела")).to_be_visible()
    for key in ("day", "month", "year"):
        expect(page.locator(f'a[href="/encyclopedia/position/{key}"]')).to_be_visible()
    expect(page.get_by_role("heading", name="Все 22 аркана в этой позиции")).to_have_count(0)

    page.goto(f"{BASE}/encyclopedia/position/day", wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name="Все 22 аркана в этой позиции")).to_be_visible()
