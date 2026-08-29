"""Цикл 12, ступень 1: толкование позиции одно на весь сайт."""
from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page

from conftest import BASE

pytestmark = pytest.mark.bug

# центр 8, комфорт в деле 12, комфорт в отношениях 9 — арканы разные, поэтому подмена видна
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
        ("Комфорт в деле", "comfort_south"),
        ("Комфорт в отношениях", "comfort_north"),
        ("Центр карты", "center"),
        ("Опора рода", "year"),
    ],
)
def test_matrix_page_prints_the_text_of_the_position(page: Page, label: str, key: str):
    """Страница матрицы печатала пул раздела: под «Комфортом в деле» стоял текст про центр."""
    page.goto(f"{BASE}/matrix/{SLUG}", wait_until="domcontentloaded")
    text = _position_text(page, label)

    page.goto(f"{BASE}/encyclopedia/position/{key}", wait_until="domcontentloaded")
    reference = _norm(page.inner_text("main"))
    assert text in reference, (
        f"толкование «{label}» на /matrix/{SLUG} не совпадает с позицией {key}: «{text}»"
    )
