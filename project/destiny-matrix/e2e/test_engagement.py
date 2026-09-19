"""Отсечки присутствия: пока вкладка на экране, Метрика получает сигналы и время визита растёт.

Стенд нужен со счётчиком: METRIKA_ID=111856670 compose/scripts/run.sh. Запросы к mc.yandex.ru
перехвачены — наружу не уходит ничего, проверяются вызовы ym. Прогон идёт минуту: отсечки
привязаны к настоящему времени, подменять его в живом браузере нечем.
"""
from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page

from conftest import BASE

pytestmark = pytest.mark.slow

# Счётчик ставит window.ym сам, но только если его ещё нет (`m[i]=m[i]||...`), поэтому заглушка,
# объявленная до загрузки страницы, переживает инициализацию.
STUB = "window.__ym = []; window.ym = function () { window.__ym.push(Array.from(arguments)); };"
HIDE = ("Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });"
        "document.dispatchEvent(new Event('visibilitychange'));")
SHOW = ("Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });"
        "document.dispatchEvent(new Event('visibilitychange'));")


def _alive(page: Page) -> list[int]:
    calls = page.evaluate("window.__ym || []")
    return [c[2]["alive"] for c in calls
            if len(c) > 2 and c[1] == "params" and isinstance(c[2], dict) and "alive" in c[2]]


def test_metrika_gets_signals_while_the_tab_is_open(page: Page):
    """Без сигналов чтение статьи неотличимо от ухода на 15-й секунде — визит упирается в notBounce."""
    page.add_init_script(STUB)
    page.route(re.compile(r"mc\.yandex\.ru"),
               lambda route: route.fulfill(status=200, body="", content_type="application/javascript"))
    page.goto(f"{BASE}/encyclopedia/arcanum/7", wait_until="domcontentloaded")
    # Заглушка стоит всегда, поэтому о включённом счётчике говорит не она, а вызов init из
    # скрипта Метрики: без NEXT_PUBLIC_METRIKA_ID компонент не рендерится вовсе.
    page.wait_for_timeout(2_000)
    if not any(len(c) > 1 and c[1] == "init" for c in page.evaluate("window.__ym || []")):
        pytest.skip("счётчик на стенде выключен: METRIKA_ID не задан")

    page.wait_for_timeout(23_000)
    assert _alive(page) == [20], f"на 23-й секунде ждали отсечку 20, пришло {_alive(page)}"

    page.evaluate(HIDE)
    page.wait_for_timeout(25_000)
    assert _alive(page) == [20], f"брошенная вкладка накручивает время: {_alive(page)}"

    page.evaluate(SHOW)
    page.wait_for_timeout(22_000)
    assert _alive(page) == [20, 40], f"после возврата ждали 40, пришло {_alive(page)}"

    hits = [c for c in page.evaluate("window.__ym || []") if len(c) > 1 and c[1] == "hit"]
    assert not hits, f"отсечка ушла как просмотр страницы, поедут глубина и страницы выхода: {hits}"
