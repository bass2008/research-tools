"""Центр E–M–K и профессия B–P–K живут полными разборами в энциклопедии."""
from __future__ import annotations

import re

from playwright.sync_api import Page, expect

from conftest import BASE
import flows


def _calculate(page: Page) -> None:
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])', timeout=20_000)
    page.select_option("#d", "7")
    page.select_option("#m", "3")
    page.select_option("#y", "1990")
    page.get_by_test_id("sex-m").click()
    page.get_by_test_id("calc-submit").click()
    expect(page.locator("#result")).to_contain_text("7 марта 1990", timeout=20_000)


def test_free_comfort_section_opens_personal_encyclopedia_article(page: Page) -> None:
    _calculate(page)

    section = page.get_by_test_id("section-comfort")
    section.locator("summary").click()
    for role in ("Центр карты", "Вход линии отношений и хвоста", "Внутренняя точка таланта"):
        card = section.locator(f'[data-position="{role}"]')
        for label in ("Суть.", "Сила.", "Риск.", "Действие."):
            expect(card.get_by_text(label, exact=True)).to_be_visible()
    expect(section.get_by_test_id("character-conclusion")).to_be_visible()

    links = section.get_by_test_id("comfort-encyclopedia-links")
    expect(links).to_contain_text("По вашей матрице")
    expect(links).to_contain_text("О методе")
    expect(links.locator(".character-encref-separator")).to_be_visible()
    expect(links.get_by_role("link", name="Как читать раздел «Центр и внутренние точки» →")).to_have_attribute(
        "href", "/encyclopedia/position/comfort"
    )
    personal = page.get_by_test_id("comfort-full-link")
    expect(personal).to_have_attribute("href", "/encyclopedia/comfort/4-15-7")
    personal.click()

    page.wait_for_url(f"{BASE}/encyclopedia/comfort/4-15-7")
    reading = page.get_by_test_id("comfort-reading")
    expect(reading.locator('[data-role="E"]')).to_contain_text("Император")
    expect(reading.locator('[data-role="M"]')).to_contain_text("Дьявол")
    expect(reading.locator('[data-role="K"]')).to_contain_text("Колесница")
    expect(reading.get_by_role("heading", name="Три внутренних ориентира")).to_be_visible()
    expect(reading.get_by_role("heading", name="Как внутренние точки влияют друг на друга")).to_be_visible()
    expect(page.locator('meta[name="robots"]')).to_have_attribute("content", "noindex, follow")
    expect(page.locator(".enc-crumbs")).to_contain_text("Разделы отчёта")


def test_profession_article_covers_line_and_common_seo_article(page: Page) -> None:
    page.goto(f"{BASE}/encyclopedia/profession/3-10-7", wait_until="domcontentloaded")

    reading = page.get_by_test_id("profession-reading")
    expect(reading.locator('[data-role="B"]')).to_contain_text("Императрица")
    expect(reading.locator('[data-role="P"]')).to_contain_text("Колесо")
    expect(reading.locator('[data-role="K"]')).to_contain_text("Колесница")
    expect(reading.get_by_role("heading", name="Три звена профессиональной реализации")).to_be_visible()
    expect(reading.get_by_role("heading", name="Как талант превращается в дело")).to_be_visible()
    expect(reading).to_contain_text("Это не список обязательных профессий")
    expect(page.locator('meta[name="robots"]')).to_have_attribute("content", "noindex, follow")
    cards = reading.locator(".character-role")
    tops = [cards.nth(index).bounding_box()["y"] for index in range(3)]
    assert max(tops) - min(tops) < 1

    page.goto(f"{BASE}/encyclopedia/position/profession", wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name="Что показывает профессия в матрице судьбы")).to_be_visible()
    expect(page.get_by_role("heading", name="Точка P — задачи и подходящий формат работы")).to_be_visible()
    expect(page.get_by_role("heading", name="Пример линии таланта 3–10–7")).to_be_visible()
    expect(page.get_by_role("link", name="Посмотреть разбор 3–10–7 в энциклопедии →")).to_have_attribute(
        "href", "/encyclopedia/profession/3-10-7"
    )


def test_common_comfort_article_and_unknown_personal_triples(page: Page) -> None:
    page.goto(f"{BASE}/encyclopedia/position/comfort", wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name="Что показывает центр в матрице судьбы")).to_be_visible()
    expect(page.get_by_role("heading", name="Точка E — базовое состояние и внутренняя опора")).to_be_visible()
    expect(page.get_by_role("heading", name="Пример разбора внутренних точек 4–15–7")).to_be_visible()
    expect(page.get_by_role("link", name="Посмотреть разбор 4–15–7 в энциклопедии →")).to_have_attribute(
        "href", "/encyclopedia/comfort/4-15-7"
    )

    response = page.goto(f"{BASE}/encyclopedia/comfort/1-1-1", wait_until="domcontentloaded")
    assert response is not None and response.status == 404
    response = page.goto(f"{BASE}/encyclopedia/profession/23-1-1", wait_until="domcontentloaded")
    assert response is not None and response.status == 404


def test_personal_section_cards_fit_mobile_without_horizontal_overflow(page: Page) -> None:
    page.set_viewport_size({"width": 390, "height": 844})
    for path, test_id in (
        ("/encyclopedia/comfort/4-15-7", "comfort-reading"),
        ("/encyclopedia/profession/3-10-7", "profession-reading"),
    ):
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        reading = page.get_by_test_id(test_id)
        expect(reading).to_be_visible()
        cards = reading.locator(".character-role")
        assert cards.count() == 3
        tops = [cards.nth(index).bounding_box()["y"] for index in range(3)]
        assert tops[0] < tops[1] < tops[2]
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        assert overflow <= 1


def test_all_reachable_repeat_shapes_render_once(page: Page) -> None:
    cases = (
        ("/encyclopedia/comfort/9-9-10", "comfort-reading", "Отшельник повторяется: позиции E, M"),
        ("/encyclopedia/comfort/22-6-6", "comfort-reading", "Влюблённые повторяется: позиции M, K"),
        ("/encyclopedia/profession/7-7-18", "profession-reading", "Колесница повторяется: позиции B, P"),
        ("/encyclopedia/profession/5-10-5", "profession-reading", "Иерофант повторяется: позиции B, K"),
    )
    for path, test_id, repeat_title in cases:
        response = page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        assert response is not None and response.status == 200
        reading = page.get_by_test_id(test_id)
        expect(reading.get_by_role("heading", name=repeat_title)).to_have_count(1)
        assert reading.locator("[data-interaction]").count() == 2
        expect(page.locator(f"#{test_id}-interactions-title")).to_have_count(1)


def test_iter3_personal_articles_are_inside_encyclopedia_and_noindex(page: Page) -> None:
    pages = (
        ("realisation/11-22-8", "realisation-reading", 3),
        ("karma40/15-8", "karma40-reading", 2),
        ("resources/8-13", "resources-reading", 2),
        ("family_gifts/7-7-13-22", "family_gifts-reading", 4),
        ("soul_tasks/3-11-14", "soul_tasks-reading", 3),
        ("purpose/22-8-3-11", "purpose-reading", 4),
        ("money/8-13-5-8", "money-reading", 4),
        ("money40/13-8", "money40-reading", 2),
        ("relations/15-20-5-7", "relations-reading", 4),
        ("parents_children/7-7-6", "parents_children-reading", 3),
        ("ancestry/15-13-22-11", "ancestry-reading", 4),
        ("body_resource/22-11-6", "body_resource-reading", 3),
        ("rest/5-4", "rest-reading", 2),
        ("loops/11-4-3", "loops-reading", 3),
    )
    for path, test_id, role_count in pages:
        response = page.goto(f"{BASE}/encyclopedia/{path}", wait_until="domcontentloaded")
        assert response is not None and response.status == 200
        expect(page.locator('meta[name="robots"]')).to_have_attribute("content", "noindex, follow")
        expect(page.locator(".enc-crumbs")).to_contain_text("Разделы отчёта")
        reading = page.get_by_test_id(test_id)
        expect(reading).to_be_visible()
        assert reading.locator(".character-role").count() == role_count
        expect(reading.get_by_role("heading", name="Практический шаг")).to_be_visible()


def test_chakra_map_and_year_timeline_keep_exact_personal_context(page: Page) -> None:
    chakra = "/encyclopedia/chakras/4-3-7-12-10-22-8-7-15-12-11-5-4-4-8-8-15-5-22-11-6-7-7-14"
    response = page.goto(f"{BASE}{chakra}", wait_until="domcontentloaded")
    assert response is not None and response.status == 200
    reading = page.get_by_test_id("chakras-reading")
    expect(page).to_have_title(re.compile(r"Карта энергий: толкование семи уровней для матрицы 4–3–22"))
    assert reading.locator("tr[data-chakra]").count() == 7
    assert reading.locator("td[data-column]").count() == 21
    expect(page.locator('meta[name="robots"]')).to_have_attribute("content", "noindex, follow")

    years = "/encyclopedia/years/4-7-3-7-22-6-11-15?birth=1993-03-31"
    response = page.goto(f"{BASE}{years}", wait_until="domcontentloaded")
    assert response is not None and response.status == 200
    timeline = page.get_by_test_id("years-reading")
    expect(page).to_have_title(re.compile(r"Разбор по десятилетиям до 80 лет: 31 марта 1993"))
    expect(page.locator('meta[name="description"]')).to_have_attribute(
        "content", re.compile(r"для даты 31 марта 1993")
    )
    assert timeline.locator("[data-period]").count() == 8
    assert timeline.locator('[data-current="true"]').count() == 1
    assert timeline.locator('[data-next="true"]').count() == 1
    expect(timeline).to_contain_text("Сейчас возраст 33")

    response = page.goto(f"{BASE}/encyclopedia/chakras/4-12-8-12-4-8-22-7-7-14")
    assert response is not None and response.status == 404
    response = page.goto(f"{BASE}/encyclopedia/years/4-7-3-7-22-6-11-15?birth=bad")
    assert response is not None and response.status == 404


def test_iter3_common_articles_are_full_and_indexable(page: Page) -> None:
    keys = (
        "realisation", "karma40", "resources", "family_gifts", "soul_tasks", "past_lives",
        "purpose", "money", "money40", "relations", "parents_children", "ancestry",
        "body_resource", "chakras", "rest", "loops", "years",
    )
    for key in keys:
        response = page.goto(f"{BASE}/encyclopedia/position/{key}", wait_until="domcontentloaded")
        assert response is not None and response.status == 200
        assert page.locator("main h2").count() >= 10
        assert page.locator(".faq dt").count() >= 5
        expect(page.get_by_role("link", name="Посмотреть персональный пример в энциклопедии →")).to_be_visible()
        robots = page.locator('meta[name="robots"]')
        if robots.count():
            expect(robots).not_to_have_attribute("content", "noindex, follow")


def test_all_20_personal_article_layouts_fit_mobile_and_desktop(page: Page) -> None:
    paths = (
        "/encyclopedia/character/4-3-22",
        "/encyclopedia/comfort/4-15-7",
        "/encyclopedia/profession/3-10-7",
        "/encyclopedia/realisation/11-22-8",
        "/encyclopedia/karma40/15-8",
        "/encyclopedia/resources/8-13",
        "/encyclopedia/family_gifts/7-7-13-22",
        "/encyclopedia/soul_tasks/3-11-14",
        "/encyclopedia/karmic-tail/15-8-11",
        "/encyclopedia/purpose/22-8-3-11",
        "/encyclopedia/money/8-13-5-8",
        "/encyclopedia/money40/13-8",
        "/encyclopedia/relations/15-20-5-7",
        "/encyclopedia/parents_children/7-7-6",
        "/encyclopedia/ancestry/15-13-22-11",
        "/encyclopedia/body_resource/22-11-6",
        "/encyclopedia/chakras/4-3-7-12-10-22-8-7-15-12-11-5-4-4-8-8-15-5-22-11-6-7-7-14",
        "/encyclopedia/rest/5-4",
        "/encyclopedia/loops/11-4-3",
        "/encyclopedia/years/4-7-3-7-22-6-11-15?birth=1993-03-31",
    )
    # 320 и 768 px раньше не проверялись нигде — там и жила прокрутка карты чакр (57 и 17 px):
    # последний шаг крошек — слаг из 24 чисел, а флекс-элемент не сжимался ниже содержимого.
    for width, height in ((320, 720), (360, 780), (390, 844), (768, 1024), (1366, 900)):
        page.set_viewport_size({"width": width, "height": height})
        for path in paths:
            response = page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
            assert response is not None and response.status == 200, f"{width}px: {path}"
            expect(page.locator("main h1").first).to_be_visible()
            overflow = page.evaluate(
                "document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            assert overflow <= 1, f"{width}px: {path} overflows by {overflow}px"
            # Документ мог не прокручиваться, а текст всё равно выезжал за свою карточку:
            # у разделов с четырьмя ролями сетка оставалась в две колонки по 110 px и строки
            # налезали на соседнюю карточку. Меряем каждую карточку отдельно.
            spill = page.evaluate(
                """() => Array.from(document.querySelectorAll('.character-role')).map((card) => {
                     const box = card.getBoundingClientRect();
                     let worst = 0;
                     for (const node of card.querySelectorAll('p, h2, h3, li, strong')) {
                       const rect = node.getBoundingClientRect();
                       worst = Math.max(worst, rect.right - box.right, box.left - rect.left);
                     }
                     return Math.round(worst);
                   })"""
            )
            worst = max(spill or [0])
            assert worst <= 2, f"{width}px: {path} — текст выезжает за карточку на {worst}px"


def test_chakras_and_years_have_only_readable_interaction_captions(page: Page) -> None:
    page.goto(
        f"{BASE}/encyclopedia/chakras/4-3-7-12-10-22-8-7-15-12-11-5-4-4-8-8-15-5-22-11-6-7-7-14",
        wait_until="domcontentloaded",
    )
    captions = page.locator("[data-testid=chakras-reading] [data-interaction] > .cap").all_inner_texts()
    assert captions
    assert not any(re.search(r"\b(?:physics|energy|emotions)\b", value) for value in captions)
    assert not any(value.strip() == "Позиции" for value in captions)

    page.goto(
        f"{BASE}/encyclopedia/years/4-7-3-7-22-6-11-15?birth=1993-03-31",
        wait_until="domcontentloaded",
    )
    for key in ("returns", "sharp-changes"):
        block = page.locator(f'[data-interaction="{key}"]')
        if block.count():
            expect(block.locator(":scope > .cap")).to_have_count(0)


def test_paid_report_uses_personal_articles_for_every_long_section(page: Page, mail: str) -> None:
    assert flows.buy(page, mail, 31, 3, 1993, sex="f") == ""
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_url(f"{BASE}/report**")
    expect(page.get_by_test_id("report")).to_be_visible(timeout=20_000)

    personal = (
        "character", "comfort", "profession", "realisation", "karma40", "resources",
        "family_gifts", "soul_tasks", "past_lives", "purpose", "money", "money40",
        "relations", "parents_children", "ancestry", "body_resource", "chakras", "rest",
        "loops", "years",
    )
    for key in personal:
        section = page.get_by_test_id(f"section-{key}")
        expect(section).to_have_attribute("data-locked", "false")
        expect(section.get_by_test_id(f"{key}-full-link")).to_have_attribute(
            "href", re.compile(r"^/encyclopedia/")
        )
        # В полном отчёте раскрыт только первый accordion. Проверяем ссылку в DOM, не меняя
        # состояние остальных разделов ради самой проверки.
        expect(section.locator(f'a[href="/encyclopedia/position/{key}"]')).to_have_count(1)

    tail = page.get_by_test_id("section-past_lives")
    expect(tail.get_by_test_id("past-lives-full-article")).to_be_attached()
    expect(tail.get_by_test_id("past_lives-full-link")).to_have_attribute(
        "href", "/encyclopedia/karmic-tail/15-8-11"
    )
