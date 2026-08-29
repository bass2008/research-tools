"""Регрессии, при которых обычное обновление страницы запускает цикл навигаций."""
from __future__ import annotations

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import CDPSession, Page, expect

import flows
from conftest import ADMIN, BASE


# По одному реальному адресу на каждый page.tsx/вариант layout. Динамические страницы кабинета
# ниже дополняются ссылками из текущей БД. Для тысяч однотипных SEO-страниц проверяем каждый тип,
# потому что цикл создаёт общий клиентский каркас, а не содержимое конкретного аркана.
REFRESH_ROUTES = [
    "/",
    "/avtor",
    "/energii",
    "/karmicheskaya-matrica",
    "/na-god",
    "/na-god/1",
    "/o-metode",
    "/programmy",
    "/account",
    "/admin",
    "/admin/users/999999",
    "/contacts",
    "/encyclopedia",
    "/encyclopedia?sec=arc",
    "/encyclopedia/arcanum/1",
    "/encyclopedia/chakra/sahasrara",
    "/encyclopedia/combination/1-2",
    "/encyclopedia/karmic-tail",
    "/encyclopedia/karmic-tail/10-11-10",
    "/encyclopedia/position/character",
    "/forgot",
    "/login",
    "/matrices/999999",
    "/matrix",
    "/matrix/1-1-2",
    "/oferta",
    "/pay",
    "/pay/single",
    "/pay/done",
    "/pay/fail",
    "/privacy",
    "/refund",
    "/register",
    "/report",
    "/reset?token=invalid",
    "/print/report?m=1&t=invalid",
    "/definitely-missing-page",
]


def _latency(cdp: CDPSession, milliseconds: int) -> None:
    cdp.send(
        "Network.emulateNetworkConditions",
        {
            "offline": False,
            "latency": milliseconds,
            "downloadThroughput": -1,
            "uploadThroughput": -1,
        },
    )


def _refresh_documents(page: Page, cdp: CDPSession) -> tuple[list[str], PlaywrightError | None]:
    """Обновить страницу как F5+возврат фокуса и вернуть все начатые document-навигации."""
    documents: list[str] = []

    def remember(request) -> None:
        if request.is_navigation_request() and request.resource_type == "document":
            documents.append(request.url)

    _latency(cdp, 800)
    page.on("request", remember)
    reload_error: PlaywrightError | None = None
    try:
        page.reload(wait_until="domcontentloaded", timeout=15_000)
    except PlaywrightError as exc:
        reload_error = exc
    try:
        # После обновления из панели браузера документ снова получает фокус. Playwright reload()
        # сам это оконное событие не воспроизводит, поэтому посылаем его явно.
        page.wait_for_timeout(150)
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        page.wait_for_timeout(1_400)
    except PlaywrightError as exc:
        reload_error = reload_error or exc
    finally:
        page.remove_listener("request", remember)
        _latency(cdp, 0)
    return documents, reload_error


def test_admin_hard_refresh_does_not_start_navigation_loop(page: Page) -> None:
    """После F5 должен быть ровно один новый запрос документа /admin."""
    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    expect(page.get_by_test_id("admin-users")).to_be_visible(timeout=20_000)

    # На быстрой локальной сети /auth/me иногда успевает закончиться до pageshow и скрывает
    # гонку. На проде запрос идёт через nginx и BFF; небольшой сетевой лаг оставляет первичную
    # сессию в состоянии loading в момент pageshow — это и есть наблюдаемое пользователем окно.
    cdp = page.context.new_cdp_session(page)
    cdp.send("Network.enable")
    documents, reload_error = _refresh_documents(page, cdp)

    assert reload_error is None and len(documents) == 1, (
        "одно обновление /admin должно делать один document-запрос; "
        f"получено {len(documents)}: {documents}; ошибка reload: {reload_error}"
    )
    expect(page.get_by_test_id("admin-users")).to_be_visible()


def test_hard_refresh_is_stable_on_every_page_type(page: Page) -> None:
    """Общий каркас не должен повторно обновлять ни один тип страницы сайта."""
    flows.login(page, *ADMIN)

    # Реальные id зависят от содержимого БД, поэтому берём доступные ссылки, но сохраняем
    # статические запасные адреса выше: тест остаётся полным и на только что очищенной БД.
    page.goto(f"{BASE}/account", wait_until="domcontentloaded")
    saved = page.locator('a[href^="/matrices/"]').evaluate_all(
        "links => links.map(link => link.getAttribute('href')).filter(Boolean)",
    )
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    users = page.locator('a[href^="/admin/users/"]').evaluate_all(
        "links => links.map(link => link.getAttribute('href')).filter(Boolean)",
    )
    routes = list(dict.fromkeys([*REFRESH_ROUTES, *saved, *users]))

    cdp = page.context.new_cdp_session(page)
    cdp.send("Network.enable")
    failures: list[str] = []
    for path in routes:
        try:
            page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=20_000)
            page.wait_for_timeout(350)
            documents, reload_error = _refresh_documents(page, cdp)
        except PlaywrightError as exc:
            failures.append(f"{path}: не открылся ({exc})")
            _latency(cdp, 0)
            continue
        if reload_error is not None or len(documents) != 1:
            failures.append(
                f"{path}: document-запросов {len(documents)} {documents}, reload: {reload_error}"
            )

    assert not failures, "нестабильное обновление страниц:\n" + "\n".join(failures)
