"""Счётчик присутствия различает браузер человека и открытые в нём вкладки."""
from __future__ import annotations

import json

from playwright.sync_api import Browser, Page, expect

import flows
from conftest import ADMIN, BASE, _credentials


HUMAN_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
)


def test_five_tabs_send_one_visitor_and_five_tab_ids(browser: Browser) -> None:
    context = browser.new_context(
        locale="ru-RU", http_credentials=_credentials(), user_agent=HUMAN_AGENT,
    )
    beats: list[dict] = []

    def remember(request) -> None:
        if request.url.split("?", 1)[0] == f"{BASE}/api/pulse" and request.post_data:
            beats.append(json.loads(request.post_data))

    context.on("request", remember)
    pages = []
    for path in ["/", "/", "/", "/account", "/admin"]:
        tab = context.new_page()
        pages.append(tab)
        tab.goto(f"{BASE}{path}", wait_until="domcontentloaded")

    for _ in range(30):
        if len(beats) >= 5:
            break
        pages[-1].wait_for_timeout(100)
    context.close()

    assert len(beats) >= 5, f"пульс пришёл не из всех вкладок: {beats}"
    first_beats = beats[:5]
    assert len({beat.get("visitor") for beat in first_beats}) == 1, first_beats
    assert len({beat.get("tab") for beat in first_beats}) == 5, first_beats


def test_admin_names_people_and_tabs_separately(page: Page) -> None:
    pulse = {
        "at": "2026-08-29T20:00:00Z",
        "memory": {"total_mb": 1967, "used_mb": 833, "percent": 42.4},
        "cpu": {"load1": 0.2, "load5": 0.2, "load15": 0.2, "cores": 2, "percent": 10},
        "disk": {"path": "/", "total_gb": 20, "free_gb": 12, "used_gb": 8, "percent": 40},
        "data_disk": {
            "path": "/srv/api/var", "total_gb": 20, "free_gb": 12,
            "used_gb": 8, "percent": 40,
        },
        "online": {
            "people": 1,
            "tabs": 5,
            "robots": 0,
            "pages": [
                {"path": "/", "people": 1, "tabs": 3},
                {"path": "/account", "people": 1, "tabs": 1},
                {"path": "/admin", "people": 1, "tabs": 1},
            ],
        },
        "print": {"active": 0, "waiting": 0, "failures_hour": 0},
        "payments": {"stuck": 0},
        "errors": {"last10min": 0, "hour": 0},
        "crawlers": None,
        "version": "test",
    }
    page.route("**/api/admin/pulse", lambda route: route.fulfill(json=pulse))
    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")

    online = page.get_by_test_id("pulse-online")
    expect(online).to_have_text("1 человек · 5 вкладок сейчас")
    panel = page.get_by_test_id("admin-pulse")
    expect(panel).to_contain_text("Смотрят: / (1 человек · 3 вкладки)")
