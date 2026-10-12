"""Меню пользователя → визиты: реальные записи API в popup, desktop и mobile."""
import pytest
from playwright.sync_api import expect

from conftest import ADMIN, BASE
from test_admin_actions import open_actions


@pytest.mark.parametrize("width", [1360, 390])
def test_admin_visits_popup(page, mail, width):
    page.set_viewport_size({"width": width, "height": 950})
    response = page.request.post(f"{BASE}/api/auth/register", data={"email": mail, "password": "1234"})
    assert response.ok
    ids = ["1791351251663069918", "1791351251663069919"]
    for client_id in ids:
        response = page.request.post(f"{BASE}/api/auth/metrika-client", data={
            "counter_id": 111856670, "client_id": client_id,
        })
        assert response.ok
    assert page.request.post(f"{BASE}/api/auth/login", data={"email": ADMIN[0], "password": ADMIN[1]}).ok
    open_actions(page, mail)
    page.get_by_test_id("action-visits").click()
    dialog = page.get_by_test_id("user-visits-dialog")
    expect(dialog).to_be_visible()
    expect(dialog.locator("tbody tr")).to_have_count(2)
    for client_id in ids:
        expect(dialog.locator("code", has_text=client_id)).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.keyboard.press("Escape")
    expect(dialog).to_have_count(0)
    page.get_by_test_id("admin-user-row").filter(has_text=mail).get_by_test_id("user-actions").click()
    page.get_by_test_id("action-visits").click()
    expect(dialog.locator("tbody tr")).to_have_count(2)
    dialog.get_by_role("button", name="Закрыть", exact=True).click()
    expect(dialog).to_have_count(0)
