"""Гидратация статических страниц: HTML из сборки и первый рендер в браузере обязаны совпасть.

Дефект 9 сентября 2026: форма расчёта и карта-пример брали «сегодня» с часов браузера, а HTML
главной печатается один раз при сборке, в UTC. У московского посетителя после полуночи (и у всех
восточнее — почти весь вечер) число расходилось, React ловил расхождение текста и перерисовывал
поддерево: в консоли лежала ошибка #418, а карта-пример пересчитывалась заново.
"""
from __future__ import annotations

import datetime as dt

import pytest

import flows
from conftest import BASE, _credentials

# Пояса восточнее UTC: в них локальная дата обгоняет дату сборки в вечерние часы по UTC.
ZONES = ["UTC", "Europe/Moscow", "Asia/Vladivostok", "Pacific/Kiritimati", "America/Los_Angeles"]

PAGES = ["/", "/matrix", "/matrix/31-03-1993", "/na-god/4", "/pay", "/login", "/report"]


def errors(page) -> list[str]:
    found: list[str] = []
    page.on("pageerror", lambda e: found.append(str(e)))
    return found


@pytest.mark.parametrize("zone", ZONES)
def test_landing_hydrates_in_any_timezone(browser, zone):
    context = browser.new_context(timezone_id=zone, locale="ru-RU", http_credentials=_credentials())
    page = context.new_page()
    found = errors(page)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1200)
    context.close()
    assert found == [], f"{zone}: {found}"


@pytest.mark.parametrize("path", PAGES)
def test_pages_hydrate_after_midnight_in_moscow(browser, path):
    """Час, когда дефект и вылез: в Москве уже следующие сутки, а HTML напечатан вчера по UTC."""
    context = browser.new_context(timezone_id="Europe/Moscow", locale="ru-RU",
                                 http_credentials=_credentials())
    page = context.new_page()
    found = errors(page)
    page.clock.install(time=dt.datetime.now(dt.timezone.utc).replace(hour=21, minute=30))
    page.goto(BASE + path, wait_until="networkidle")
    page.wait_for_timeout(1200)
    context.close()
    assert found == [], f"{path}: {found}"


def test_landing_hydrates_when_the_build_is_stale(browser):
    """Статику собрали давно: у посетителя другая дата, а HTML остался прежним."""
    context = browser.new_context(timezone_id="Europe/Moscow", locale="ru-RU",
                                 http_credentials=_credentials())
    page = context.new_page()
    found = errors(page)
    page.clock.install(time=dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=40))
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1200)
    context.close()
    assert found == [], found


def test_year_list_follows_the_browser_not_the_build(browser):
    """Список лет обязан доходить до года браузера: иначе с января и до первого релиза года
    новый год выбрать нечем. Значение по умолчанию при этом остаётся из сборки — в HTML оно
    напечатано и меняться после гидратации не должно."""
    context = browser.new_context(timezone_id="Europe/Moscow", locale="ru-RU",
                                 http_credentials=_credentials())
    page = context.new_page()
    ahead = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=400)
    page.clock.install(time=ahead)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1500)
    years = page.locator("#y option").evaluate_all("list => list.map(o => Number(o.value))")
    context.close()
    assert ahead.year in years, f"года {ahead.year} нет в списке: {years[:3]}"


def test_calculation_still_works_from_the_form(page):
    """Правка не должна стоить работоспособности: считаем дату руками и ждём карту."""
    flows.calculate(page, 31, 3, 1993, "f")
    assert flows.open_sections(page) >= 1, "после расчёта нет ни одного открытого раздела"
