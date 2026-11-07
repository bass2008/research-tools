"""«Поделиться» у разбора: ссылка открывает его любому без входа, ровно в том виде, что видит владелец."""
import re
from urllib.parse import unquote

from playwright.sync_api import expect

import flows
from conftest import BASE, _credentials
from test_pair import calc_pair


def test_a_shared_reading_opens_without_signing_in(page, browser, mail):
    flows.buy(page, mail, 31, 3, 1993)
    mid = flows.matrix_ids(page)[0]
    page.goto(f"{BASE}/matrices/{mid}", wait_until="networkidle")
    page.get_by_test_id("share-button").click()
    menu = page.get_by_test_id("share-menu")
    expect(menu).to_be_visible()
    assert menu.locator("[data-network]").evaluate_all("els => els.map(e => e.dataset.network)") == ["copy", "telegram", "vk", "whatsapp"]
    url = menu.get_attribute("data-url")
    assert re.search(r"/ru/s/[\w.-]{40,}$", url), url
    assert url.split("/s/")[1] in menu.locator('[data-network="telegram"]').get_attribute("href")

    page.context.grant_permissions(["clipboard-read", "clipboard-write"])
    page.get_by_test_id("share-copy").click()
    expect(page.get_by_test_id("share-copy")).to_contain_text("Ссылка скопирована")
    assert page.evaluate("navigator.clipboard.readText()") == url
    page.context.route("https://t.me/**", lambda route: route.abort())
    with page.context.expect_page() as telegram:
        menu.locator('[data-network="telegram"]').click()
    telegram.value.close()
    events = page.evaluate("(window.dataLayer || []).filter(e => e.event.startsWith('share_')).map(({ event, ...rest }) => [event, rest])")
    assert events == [["share_open", {"place": "reading"}], ["share_send", {"place": "reading", "network": "copy"}],
                      ["share_send", {"place": "reading", "network": "telegram"}]], events

    guest = browser.new_context(http_credentials=_credentials())
    other = guest.new_page()
    other.goto(url, wait_until="networkidle")
    expect(other.get_by_test_id("shared-note")).to_be_visible()
    expect(other.locator("main")).to_contain_text("31 марта 1993")
    expect(other.get_by_test_id("share-button")).to_have_count(0)
    expect(other.get_by_test_id("save-pdf")).to_have_count(0)
    guest.close()


def test_a_shared_pair_opens_full_without_signing_in(page, browser, mail):
    calc_pair(page)
    flows.open_pair_pay(page)
    assert flows.pay(page, mail) == ""
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_url(re.compile(r"/readings/\d+"))
    page.get_by_test_id("share-button").click()
    menu = page.get_by_test_id("share-menu")
    url = menu.get_attribute("data-url")
    assert "28 декабря 1994" in unquote(menu.locator('[data-network="vk"]').get_attribute("href"))

    guest = browser.new_context(http_credentials=_credentials())
    other = guest.new_page()
    other.goto(url, wait_until="networkidle")
    expect(other.get_by_test_id("shared-note")).to_be_visible()
    expect(other.get_by_test_id("pair-report")).to_have_attribute("data-mode", "full")
    expect(other.get_by_test_id("share-button")).to_have_count(0)
    expect(other.get_by_test_id("save-pdf")).to_have_count(0)
    assert "28 декабря 1994" in other.title(), other.title()
    og = other.request.get(f"{url}/og")
    assert og.status == 200 and og.headers["content-type"] == "image/png" and len(og.body()) > 20_000
    guest.close()


def test_the_sample_reading_is_shared_and_saved_as_is(page):
    page.goto(f"{BASE}/matrix/individual-example/pair", wait_until="networkidle")
    page.get_by_test_id("share-button").click()
    menu = page.get_by_test_id("share-menu")
    assert menu.get_attribute("data-url").endswith("/ru/matrix/individual-example/pair")
    assert "Совместимость пары" in unquote(menu.locator('[data-network="telegram"]').get_attribute("href"))
    page.keyboard.press("Escape")
    with page.expect_response(lambda r: "/individual-examples/pair/pdf" in r.url, timeout=120_000) as answer:
        page.get_by_test_id("save-pdf").click()
    assert answer.value.status == 200, answer.value.text()
    pdf = page.request.get(answer.value.json()["url"])
    assert pdf.status == 200 and pdf.body().startswith(b"%PDF")


def test_the_link_follows_the_reading_on_screen(page, browser, mail):
    """Вторая дата в той же форме без перезагрузки — ссылка уже её, а не прежней даты."""
    assert flows.buy(page, mail, 29, 2, 2000, sex="f") == ""
    assert flows.buy(page, mail, 14, 5, 1989, sex="f") == ""
    flows.calculate(page, 29, 2, 2000, "f")

    def shared() -> str:
        page.get_by_test_id("share-button").click()
        url = page.get_by_test_id("share-menu").get_attribute("data-url")
        page.keyboard.press("Escape")
        return url

    first = shared()
    page.select_option("#d", "14")
    page.select_option("#m", "5")
    page.select_option("#y", "1989")
    page.get_by_test_id("calc-submit").click()
    expect(page.locator(".rsub")).to_contain_text("14 мая 1989")
    second = shared()
    assert second != first

    guest = browser.new_context(http_credentials=_credentials())
    other = guest.new_page()
    other.goto(second, wait_until="networkidle")
    expect(other.locator("main")).to_contain_text("14 мая 1989")
    other.goto(first, wait_until="networkidle")
    expect(other.locator("main")).to_contain_text("29 февраля 2000")
    guest.close()


def test_a_corrected_partner_name_reaches_the_saved_pair_and_its_link(page, browser, mail):
    page.goto(f"{BASE}/pay/month", wait_until="domcontentloaded")
    assert flows.pay(page, mail) == ""
    calc_pair(page, "1988-03-21", "1987-04-16", "Олга", "Дмитрий")
    page.get_by_test_id("pair-open").click()
    page.wait_for_url(re.compile(r"/readings/\d+"))
    saved = page.url
    with page.expect_response(lambda r: r.url.endswith("/api/readings") and r.request.method == "POST"):
        calc_pair(page, "1988-03-21", "1987-04-16", "Ольга", "Дмитрий")
    page.get_by_test_id("share-button").click()
    url = page.get_by_test_id("share-menu").get_attribute("data-url")

    page.goto(saved, wait_until="networkidle")
    expect(page.get_by_test_id("pair-report")).to_contain_text("Ольга и Дмитрий")
    guest = browser.new_context(http_credentials=_credentials())
    other = guest.new_page()
    other.goto(url, wait_until="networkidle")
    expect(other.get_by_test_id("pair-report")).to_contain_text("Ольга и Дмитрий")
    expect(other.get_by_test_id("pair-report")).not_to_contain_text("Олга")
    guest.close()


def test_the_sample_link_follows_the_language(page):
    page.goto(f"{BASE}/matrix/individual-example/pair", wait_until="networkidle")
    page.get_by_test_id("share-button").click()
    assert "/ru/matrix/individual-example/pair" in page.get_by_test_id("share-menu").get_attribute("data-url")
    page.keyboard.press("Escape")
    page.get_by_test_id("language-en").click()
    expect(page.locator("html")).to_have_attribute("lang", "en")
    page.get_by_test_id("share-button").click()
    assert "/en/matrix/individual-example/pair" in page.get_by_test_id("share-menu").get_attribute("data-url")


def test_a_broken_share_link_is_not_found(page):
    response = page.goto(f"{BASE}/s/not-a-real-link-not-a-real-link", wait_until="domcontentloaded")
    assert response.status == 404
