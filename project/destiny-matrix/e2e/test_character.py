"""Полный разбор характера открывается из расчёта и остаётся отдельной noindex-страницей."""
from __future__ import annotations

import re

from playwright.sync_api import Page, expect

from conftest import BASE


def _calculate(page: Page) -> None:
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])', timeout=20_000)
    page.select_option("#d", "7")
    page.select_option("#m", "3")
    page.select_option("#y", "1990")
    page.get_by_test_id("sex-m").click()
    page.get_by_test_id("calc-submit").click()
    expect(page.locator("#result")).to_contain_text("7 марта 1990", timeout=20_000)


def test_calculator_opens_full_character_reading(page: Page) -> None:
    _calculate(page)

    section = page.get_by_test_id("section-character")
    expect(section).to_contain_text("Колесница")
    first_role = section.locator('[data-position="Портрет личности"]')
    for label in ("Суть.", "Сила.", "Риск.", "Действие."):
        expect(first_role.get_by_text(label, exact=True)).to_be_visible()
    conclusion = section.get_by_test_id("character-conclusion")
    expect(conclusion.get_by_role("heading", name="Итог разбора")).to_be_visible()
    expect(conclusion.get_by_role("heading", name="Главная сила")).to_be_visible()
    expect(conclusion.get_by_role("heading", name="Главное напряжение")).to_be_visible()
    expect(conclusion.get_by_role("heading", name="Практический шаг")).to_be_visible()
    links = section.get_by_test_id("character-encyclopedia-links")
    expect(links).to_contain_text("По вашей матрице")
    expect(links).to_contain_text("О методе")
    expect(links.locator(".character-encref-separator")).to_be_visible()
    expect(
        links.get_by_role("link", name="Как читать раздел «Характер и личные качества» →")
    ).to_have_attribute("href", "/encyclopedia/position/character")
    link = section.get_by_test_id("character-full-link")
    expect(link).to_have_attribute("href", "/encyclopedia/character/7-3-19")
    assert "btn" not in (link.get_attribute("class") or "").split()
    expect(link).to_have_text("Подробнее про характер 7-3-19 в энциклопедии →")
    link.click()

    page.wait_for_url(f"{BASE}/encyclopedia/character/7-3-19")
    expect(page.get_by_role("heading", name="Характер 7-3-19", exact=False)).to_be_visible()
    reading = page.get_by_test_id("character-reading")
    expect(reading.locator('[data-role="A"]')).to_contain_text("Колесница")
    expect(reading.locator('[data-role="B"]')).to_contain_text("Императрица")
    expect(reading.locator('[data-role="C"]')).to_contain_text("Солнце")
    expect(reading).to_contain_text("Как арканы работают вместе")
    expect(reading).to_contain_text("Практический шаг")
    expect(
        reading.get_by_role("link", name="Подробнее про сочетание 3 и 7 аркана в энциклопедии →")
    ).to_have_attribute("href", "/encyclopedia/combination/3-7")
    expect(page.locator('meta[name="robots"]')).to_have_attribute("content", "noindex, follow")
    expect(page.locator(".enc-crumbs")).to_contain_text("Энциклопедия")
    expect(page.locator(".enc-crumbs")).to_contain_text("Разделы отчёта")

    # Три верхних края снимаем одним вызовом: после клиентского перехода Next 16 доводит
    # прокрутку плавно, и три отдельных `bounding_box()` попадали на разные кадры движения —
    # тест краснел на 13 px при идеально выровненных карточках.
    tops = page.evaluate(
        "() => [...document.querySelectorAll('.character-role')]"
        ".map((card) => card.getBoundingClientRect().top)"
    )
    assert len(tops) == 3, f"карточек ролей {len(tops)}, ожидалось три"
    assert max(tops) - min(tops) < 1, f"карточки ролей не выровнены: {tops}"


def test_matrix_and_encyclopedia_link_to_personal_example(page: Page) -> None:
    page.goto(f"{BASE}/matrix/4-3-22", wait_until="domcontentloaded")
    expect(page.get_by_test_id("character-full-link")).to_have_attribute(
        "href", "/encyclopedia/character/4-3-22"
    )

    page.goto(f"{BASE}/encyclopedia/position/character", wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name="Точка A: портрет личности и визитка")).to_be_visible()
    expect(page.get_by_role("link", name="Посмотреть разбор 4–3–22 в энциклопедии →")).to_have_attribute(
        "href", "/encyclopedia/character/4-3-22"
    )

    response = page.goto(f"{BASE}/matrix/4-3-22/character", wait_until="domcontentloaded")
    assert response is not None and response.status == 404


def test_day_position_is_full_vizitka_article(page: Page) -> None:
    page.goto(f"{BASE}/encyclopedia/position/day", wait_until="domcontentloaded")

    expect(page).to_have_title("Визитка в матрице судьбы — аркан дня рождения — Arcana Sense")
    expect(page.get_by_role("heading", name="Что такое визитка в матрице судьбы")).to_be_visible()
    expect(page.get_by_role("heading", name="Где находится визитка в матрице судьбы")).to_be_visible()
    expect(page.get_by_role("heading", name="Как рассчитать аркан визитки по дате рождения")).to_be_visible()
    expect(page.get_by_text("Как найти точку визитки на схеме?", exact=True)).to_be_visible()
    expect(
        page.get_by_role("link", name="Подробнее о полном разделе «Характер и личные качества» →")
    ).to_have_attribute("href", "/encyclopedia/position/character")


def test_combination_page_contains_all_section_contexts(page: Page) -> None:
    # Пара 3 и 11 выбрана не случайно: это одна из семи пар, у которых достижимы все девять
    # контекстов. На 3 и 4 тест ждал связей E↔M и B↔P, которых у этой пары не бывает ни в одной
    # из 5 544 матриц, — страница была права, а тест красный.
    page.goto(f"{BASE}/encyclopedia/combination/3-11", wait_until="domcontentloaded")
    for group in (
        "Как пара работает в характере: 3 и 11",
        "Как пара работает в центре и внутренних точках: 3 и 11",
        "Как пара работает в линии таланта: 3 и 11",
    ):
        expect(page.get_by_role("heading", name=group)).to_be_visible()
    for context in (
        "Внешний образ и внутренняя задача",
        "От внутреннего качества к поступку",
        "Первое впечатление и реальное поведение",
        "Внутренняя опора и автоматическая реакция",
        "Внутренний центр и форма таланта",
        "От реакции к возвращению в центр",
        "Исходный дар и форма работы",
        "Форма работы и внутренний результат",
        "Дар и результат его реализации",
    ):
        expect(page.get_by_role("heading", name=context)).to_be_visible()
    # Хотя бы один допустимый порядок пары должен быть напечатан: печатаются только достижимые.
    expect(page.get_by_role("heading", name=re.compile(r"(3 Императрица|11 Справедливость) в ")).first).to_be_visible()
    expect(page.get_by_role("heading", name="Как проверить сочетание на практике")).to_be_visible()
