"""Медленный переход в разбор подтверждает первый клик видимым состоянием ожидания."""
import pytest
from playwright.sync_api import expect
from conftest import BASE


@pytest.mark.parametrize("product,inputs,card_id,path", [
    ("pair", {"a": {"birth": "1990-01-01"}, "b": {"birth": "1990-01-01"}}, "pair-card", "readings"),
    ("personal", {"birth": "1990-01-01", "sex": "f"}, "matrix-card", "matrices"),
])
def test_open_shows_pending_until_reading_arrives(page, mail, product, inputs, card_id, path):
    assert page.request.post(f"{BASE}/api/auth/register", data={"email": mail, "password": "1234"}).ok
    reading = page.request.post(f"{BASE}/api/readings", data={"product": product, "inputs": inputs})
    assert reading.ok
    target = f"{BASE}/{path}/{reading.json()['id']}"
    held = []
    page.route(f"{target}*", lambda route: held.append(route))
    page.goto(f"{BASE}/account", wait_until="domcontentloaded")
    link = page.get_by_test_id(card_id).locator(f'a[href="/{path}/{reading.json()["id"]}"]')
    expect(link).to_have_text("Открыть")
    link.click()
    try:
        expect(link).to_have_text("Открываем…", timeout=1500)
        expect(link.locator('[aria-busy="true"]')).to_be_visible()
        assert page.url == f"{BASE}/account"
    finally:
        for route in held:
            route.continue_()
        page.unroute(f"{target}*")
    page.wait_for_url(target)
    expect(page.locator("h1")).to_be_visible()
    page.go_back()
    expect(page.get_by_test_id(card_id).get_by_role("link", name="Открыть", exact=True)).to_be_visible()
