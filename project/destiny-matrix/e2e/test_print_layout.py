"""Printed chakras must fit the sheet: a PDF has no horizontal scrollbar."""
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
    reading = page.locator(".printmode [data-testid=chakras-reading]")
    expect(reading).to_be_visible()
    # Seven chakras plus the overall energy field, printed in both languages.
    expect(reading.locator("section[data-chakra]")).to_have_count(8)
    expect(reading.locator('section[data-chakra="energy_field"]')).to_have_count(1)
    page.evaluate("document.fonts.ready")
    sizes = reading.evaluate("""reading => {
      const right = reading.getBoundingClientRect().right;
      const blocks = [...reading.querySelectorAll('section[data-chakra]')];
      return {page: document.documentElement.clientWidth, reading: reading.getBoundingClientRect().width,
        overflowing: blocks.filter(b => b.getBoundingClientRect().right > right + 1
          || b.scrollWidth > b.clientWidth + 1).map(b => b.dataset.chakra),
        clipped: [...reading.querySelectorAll('h2,h3,p')].filter(e =>
          e.scrollWidth > e.clientWidth + 1).length};
    }""")
    assert sizes["reading"] <= sizes["page"] + 1, sizes
    assert sizes["overflowing"] == [], sizes
    assert sizes["clipped"] == 0, sizes
