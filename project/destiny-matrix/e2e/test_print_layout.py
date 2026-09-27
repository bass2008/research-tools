"""Printed tables must fit the sheet: a PDF has no horizontal scrollbar."""
import urllib.parse

import pytest
from playwright.sync_api import expect

from conftest import BASE, REMOTE, _api_command


@pytest.mark.skipif(REMOTE, reason="Uses a local mock purchase and multilingual loopback profile")
@pytest.mark.parametrize("locale", ["ru", "en"])
def test_printed_chakras_fit_all_columns(page, mail, locale):
    registered = page.request.post(BASE + "/api/auth/register", data={"email": mail, "password": "1234"})
    assert registered.ok, registered.text()
    user_id = page.request.get(BASE + "/api/auth/me").json()["user"]["id"]
    paid = page.request.post(BASE + "/api/payments/mock", data={
        "tariff": "single", "email": mail, "birth": "1993-03-04", "sex": "f",
    })
    assert paid.ok, paid.text()
    matrix_id = paid.json()["matrix_id"]
    token = _api_command(["python", "-c",
                          "from app.security import create_print_token; "
                          f"print(create_print_token({matrix_id}, {user_id}))"])
    assert token.returncode == 0, token.stderr
    port = urllib.parse.urlsplit(BASE).port or 3000
    page.set_viewport_size({"width": 1280, "height": 1200})
    page.goto(f"http://127.0.0.1:{port}/print/report?m={matrix_id}"
              f"&t={urllib.parse.quote(token.stdout.strip())}&lang={locale}")
    expect(page.locator("html")).to_have_attribute("lang", locale)
    table = page.locator(".printmode .personal-chakras")
    expect(table).to_be_visible()
    expect(table.locator("tbody tr")).to_have_count(7)
    page.evaluate("document.fonts.ready")
    sizes = table.evaluate("""table => {
      const wrapper = table.closest('.tabscroll');
      return {table: table.getBoundingClientRect().width, wrapper: wrapper.clientWidth,
        clippedCells: [...table.querySelectorAll('th,td')].filter(cell =>
          cell.scrollWidth > cell.clientWidth + 1).length};
    }""")
    assert sizes["table"] <= sizes["wrapper"] + 1, sizes
    assert sizes["clippedCells"] == 0, sizes
