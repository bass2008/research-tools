"""Language changes must preserve usable navigation on narrow screens."""
import pytest
from playwright.sync_api import expect

from conftest import BASE


@pytest.mark.parametrize("width", [320, 390])
@pytest.mark.parametrize("path", [
    "/encyclopedia/position/center", "/encyclopedia/chakra", "/encyclopedia/karmic-tail",
    "/year", "/encyclopedia/combination", "/method",
])
def test_translated_active_section_stays_visible(page, width, path):
    page.set_viewport_size({"width": width, "height": 844})
    page.goto(BASE + path)
    expect(page.locator("html")).to_have_attribute("lang", "en")
    page.evaluate("window.languageDocumentMarker = 'same-document'")
    for locale in ["ru", "en"]:
        page.get_by_test_id(f"language-{locale}").click()
        expect(page.locator("html")).to_have_attribute("lang", locale)
        # Compare to the scroll container, not to the full viewport: the menu is inset.
        page.wait_for_function("""() => {
          const nav = document.querySelector('.enc-nav');
          const active = nav?.querySelector('.on');
          if (!active) return false;
          const n = nav.getBoundingClientRect(), a = active.getBoundingClientRect();
          return a.left >= n.left - 1 && a.right <= n.right + 1;
        }""", timeout=4000)
        assert page.evaluate("window.languageDocumentMarker") == "same-document"
