"""Находки цикла 15."""
from __future__ import annotations

import pytest
from playwright.sync_api import Page

from conftest import BASE

MISSING = "/definitely-missing-page"


def _internal_links(page: Page, scope: str) -> list[tuple[str, str]]:
    return page.locator(f"{scope} a").evaluate_all(
        """list => list
             .map(a => [a.getAttribute('href') || '', (a.innerText || a.getAttribute('aria-label') || '').trim()])
             .filter(([href]) => href.startsWith('/') && !href.startsWith('/#'))""")


@pytest.mark.parametrize("scope", ("header", "footer"))
def test_every_link_leaves_the_not_found_page(page: Page, scope: str) -> None:
    """Цикл 14 починил три ссылки в теле 404 и счёл дефект закрытым. Шапку и подвал не тронули:
    они ходят через клиентский роутер, который в отдельном документе 404 меняет адрес и заголовок
    вкладки, а тело оставляет прежним. Проверяем все ссылки документа, а не список из памяти."""
    page.goto(f"{BASE}{MISSING}", wait_until="domcontentloaded")
    links = _internal_links(page, scope)
    assert links, f"в {scope} страницы 404 не нашлось ни одной внутренней ссылки"

    stuck: list[str] = []
    for index, (href, label) in enumerate(links):
        page.goto(f"{BASE}{MISSING}", wait_until="domcontentloaded")
        page.locator(f"{scope} a[href='{href}']").first.click()
        page.wait_for_timeout(1200)
        if "Такой страницы нет" in page.locator("body").inner_text():
            stuck.append(f"{label or href} → {href}")
    assert not stuck, f"с 404 не уводят ссылки {scope}: {stuck}"
