"""Совместимость пары и подписка: человек считает пару, покупает разбор или подписку и открывает
полный разбор — кликами, как на сайте."""
from __future__ import annotations

import json
import pathlib
import re

from playwright.sync_api import Page, expect

from conftest import BASE
from flows import open_pair_pay, pay

CORPUS = json.loads((pathlib.Path(__file__).resolve().parents[1] / "web" / "content" / "ru" / "pair-units.json")
                    .read_text())["items"]
# Без покупки открыты «Ради чего встретились», «Атмосфера» и две деловые сферы — base и plus.
PAID_TEXTS = [u["text"][0][:50] for u in CORPUS
              if u.get("text") and not u["unit"].startswith(("meet:", "atmosphere:", "business:base:", "business:plus:"))]
FREE_MEANING = next(u["meaning"] for u in CORPUS if u["unit"] == "atmosphere:13")
CHAKRAS = [json.loads(p.read_text()) for p in sorted(
    (pathlib.Path(__file__).resolve().parents[1] / "web" / "content" / "pair-chakras" / "ru").rglob("*.json"))]
PAID_TEXTS += [u["text"][0][:50] for u in CHAKRAS]


def calc_pair(page: Page, a: str = "1993-03-31", b: str = "1994-12-28",
              an: str = "Сергей", bn: str = "Виктория") -> None:
    page.goto(f"{BASE}/compatibility", wait_until="domcontentloaded")
    expect(page.get_by_test_id("pair-submit")).to_be_enabled()
    # поля имён свёрнуты, но после первого расчёта форма помнит их раскрытыми
    if (an or bn) and page.get_by_test_id("pair-add-names").count():
        page.get_by_test_id("pair-add-names").click()
    for who, birth, name in (("a", a, an), ("b", b, bn)):
        year, month, day = (str(int(x)) for x in birth.split("-"))
        if an or bn:
            page.locator(f"#pair-{who}-name").fill(name)
        page.get_by_test_id(f"pair-{who}-d").select_option(day)
        page.get_by_test_id(f"pair-{who}-m").select_option(month)
        page.get_by_test_id(f"pair-{who}-y").select_option(year)
    page.get_by_test_id("pair-submit").click()
    expect(page.get_by_role("heading", name=f"{an} и {bn}")).to_be_visible()


def test_free_part_shows_two_spheres_and_keeps_dates_in_the_browser(page: Page):
    sent: list[str] = []
    page.on("request", lambda r: sent.append(r.url + (r.post_data or "")))
    calc_pair(page)

    report = page.get_by_test_id("pair-report")
    expect(report).to_have_attribute("data-mode", "free")
    expect(page.get_by_test_id("pair-summary")).to_contain_text(FREE_MEANING)
    expect(page.locator("details[data-sec]:not([data-sec^=business])")).to_have_count(2)
    expect(page.get_by_test_id("pair-locks").locator("> div")).to_have_count(11)
    expect(page.get_by_test_id("plan-pair")).to_contain_text("390")
    expect(page.get_by_test_id("plan-month")).to_contain_text("590")
    expect(page.get_by_test_id("pair-main-cards")).to_contain_text("Постоянные перемены")

    for url in sent:
        assert "1993-03-31" not in url and "1994-12-28" not in url, f"дата ушла с клиента: {url}"
    html = page.content()
    for text in PAID_TEXTS:
        assert text not in html, f"платный текст на бесплатной странице: {text}"


def test_example_before_any_dates(page: Page):
    """До ввода дат в форме даты примера, как на главной, а рядом пример «Партнёр 1 и Партнёр 2»:
    замки есть, покупки нет, тексты открытых сфер стоят в HTML сервера."""
    assert FREE_MEANING in page.request.get(f"{BASE}/compatibility").text()
    page.goto(f"{BASE}/compatibility", wait_until="domcontentloaded")
    expect(page.get_by_test_id("pair-a-d")).to_have_value("31")
    expect(page.get_by_test_id("pair-b-y")).to_have_value("1994")
    report = page.get_by_test_id("pair-report")
    expect(report).to_have_attribute("data-mode", "free")
    expect(report).to_contain_text("Партнёр 1")
    expect(page.get_by_test_id("pair-locks").locator("> div")).to_have_count(11)
    expect(page.get_by_test_id("plan-pair")).to_have_count(0)
    expect(page.get_by_test_id("pair-example-cta")).to_be_visible()


def test_bought_pair_opens_full_reading_pdf_and_account(page: Page, mail: str):
    calc_pair(page)
    open_pair_pay(page)
    target = page.get_by_test_id("pay-target")
    expect(target).to_contain_text("Сергей и Виктория")
    assert pay(page, mail) == ""

    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_url(re.compile(r"/readings/\d+"))
    expect(page.get_by_test_id("pair-report")).to_have_attribute("data-mode", "full")
    expect(page.locator("details[data-sec]:not([data-sec^=business])")).to_have_count(13)
    expect(page.locator("details[data-sec^=business]")).to_have_count(10)
    assert any(text in page.content() for text in PAID_TEXTS), "полный разбор без платных текстов"
    reading = page.get_by_test_id("pair-chakras-reading")
    chakra_blocks = reading.locator("section[data-chakra]")
    expect(chakra_blocks).to_have_count(8)
    corpus = {u["unit"]: u for u in CHAKRAS}
    for block in chakra_blocks.all():
        key = block.get_attribute("data-chakra")
        triple = "-".join(re.findall(r"\d+", block.locator("strong").first.inner_text()))
        expected = corpus[f"chakra:{key}:{triple}"]
        expect(block.locator("h3").first).to_have_text(expected["title"])
        for paragraph in expected["text"]:
            expect(block).to_contain_text(paragraph.replace("**", ""))
    expect(page.get_by_test_id("save-pdf")).to_be_visible()

    page.goto(f"{BASE}/account", wait_until="domcontentloaded")
    card = page.get_by_test_id("pair-card")
    expect(card).to_have_count(1)
    expect(card).to_have_attribute("data-access", "forever")

    # калькулятор узнаёт купленную пару и сразу показывает её полный разбор
    page.goto(f"{BASE}/compatibility", wait_until="domcontentloaded")
    expect(page.get_by_test_id("pair-report")).to_have_attribute("data-mode", "full")
    calc_pair(page)
    expect(page.get_by_test_id("pair-report")).to_have_attribute("data-mode", "full")
    expect(page.get_by_test_id("plan-pair")).to_have_count(0)


def test_someone_elses_pair_is_not_shown(page: Page, mail: str):
    calc_pair(page)
    open_pair_pay(page)
    pay(page, mail)
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_url(re.compile(r"/readings/\d+"))
    address = page.url
    page.context.clear_cookies()
    page.goto(address, wait_until="domcontentloaded")
    expect(page.get_by_test_id("pair-report")).to_have_count(0)


def test_subscription_is_sold_and_opens_any_pair(page: Page, mail: str):
    page.goto(f"{BASE}/pay", wait_until="domcontentloaded")
    page.get_by_test_id("plan-month").click()
    expect(page.get_by_test_id("pay-submit")).to_contain_text("590")
    assert pay(page, mail) == ""

    calc_pair(page, "1980-01-01", "1981-02-02", "Анна", "Борис")
    opener = page.get_by_test_id("pair-open")
    expect(opener).to_be_visible()
    opener.click()
    page.wait_for_url(re.compile(r"/readings/\d+"))
    expect(page.get_by_test_id("pair-report")).to_have_attribute("data-mode", "full")
    # Полный статический корпус открывает все семь чакр и энергополе сразу.
    reading = page.get_by_test_id("pair-chakras-reading")
    expect(reading.locator("[data-chakra]")).to_have_count(8)
    expect(reading.locator("[data-empty]")).to_have_count(0)
    expect(page.get_by_test_id("chakra-pending")).to_have_count(0)
    expect(page.get_by_test_id("chakra-row-pending")).to_have_count(0)


def test_every_card_and_point_leads_to_its_arcanum(page: Page):
    """Как в личном разборе: каждая карта и каждая точка схем пары кликабельна. Атлас чакр
    открывает окно кнопкой строки — там карта тоже внутри кнопки."""
    page.goto(f"{BASE}/compatibility", wait_until="domcontentloaded")
    report = page.get_by_test_id("pair-report")
    expect(report).to_be_visible()
    loose = report.locator("img.arccard").evaluate_all(
        "cards => cards.filter(card => !card.closest('a, button')).length")
    assert loose == 0, f"карт без ссылки: {loose}"
    points = page.locator("#pair-merge svg.oct [data-map-point]")
    assert points.count() == page.locator("#pair-merge svg.oct a[data-map-point]").count() > 0
    first = page.locator("#sec-meet a[href^='/encyclopedia/compatibility/']").first
    target = first.get_attribute("href")
    first.click(force=True)
    page.wait_for_url(f"**{target}")


def test_pair_page_is_in_the_header(page: Page):
    page.goto(BASE, wait_until="domcontentloaded")
    link = page.locator("header .hnav a[href='/compatibility']")
    expect(link).to_have_text("Совместимость")


def test_receipt_survives_reload_and_leads_to_the_pair(page: Page, mail: str):
    calc_pair(page)
    open_pair_pay(page)
    assert pay(page, mail) == ""
    page.reload(wait_until="domcontentloaded")
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_url(re.compile(r"/readings/\d+"))
    expect(page.get_by_test_id("pair-report")).to_have_attribute("data-mode", "full")


def test_pair_is_open_in_english(browser):
    """Английский корпус пары полный: вход есть в меню, калькулятор открывается."""
    en = BASE.replace("localhost", "127.0.0.1")
    context = browser.new_context(locale="en-US")
    page = context.new_page()
    page.goto(en, wait_until="domcontentloaded")
    expect(page.locator("header .hnav a[href='/compatibility']")).to_have_count(1)
    assert page.goto(f"{en}/compatibility").status == 200
    expect(page.get_by_test_id("pair-report")).to_be_visible()
    context.close()


def test_compatibility_articles_are_linked_and_lead_to_the_pair_calculator(page: Page):
    page.goto(f"{BASE}/compatibility", wait_until="domcontentloaded")
    articles = page.get_by_test_id("compatibility-articles")
    for key in ("compatibility-center", "karmic-compatibility", "business-compatibility"):
        expect(articles.locator(f"a[href='/{key}']")).to_have_count(1)
    expect(page.locator("#sec-atmosphere").get_by_test_id("pair-article-atmosphere")).to_have_attribute(
        "href", "/compatibility-center")
    expect(page.get_by_test_id("pair-article-business")).to_have_attribute("href", "/business-compatibility")

    for key in ("compatibility-center", "karmic-compatibility", "business-compatibility"):
        page.goto(f"{BASE}/{key}", wait_until="domcontentloaded")
        expect(page.get_by_test_id("hub-pair-calc").locator("a[href='/compatibility']")).to_have_count(1)
        expect(page.get_by_test_id("calc-promo")).to_have_count(0)

    page.goto(f"{BASE}/encyclopedia/compatibility/16", wait_until="domcontentloaded")
    for key in ("compatibility-center", "karmic-compatibility"):
        expect(page.locator(f"main a[href='/{key}']").first).to_be_visible()
    page.goto(f"{BASE}/encyclopedia/karmic-tail/18-9-9", wait_until="domcontentloaded")
    expect(page.get_by_test_id("tail-compatibility").locator("a[href='/karmic-compatibility']")).to_have_count(1)


def test_pair_form_starts_from_the_couple_not_an_example(page: Page, mail: str):
    """Форма пары подставляла пример «1 апреля 1996 и 1 апреля 1994»: гостю по ссылке на пару из
    кабинета и купившему пару при повторном заходе."""
    calc_pair(page)
    page.goto(f"{BASE}/pay?r=999999", wait_until="domcontentloaded")
    expect(page.get_by_test_id("pay-login-note")).to_be_visible(timeout=10_000)
    expect(page.get_by_test_id("pay-pair")).to_have_count(0)
    expect(page.get_by_test_id("pay-submit")).to_be_disabled()

    page.goto(f"{BASE}/compatibility", wait_until="domcontentloaded")
    open_pair_pay(page)
    assert pay(page, mail) == ""
    page.goto(f"{BASE}/pay/pair", wait_until="domcontentloaded")
    expect(page.get_by_test_id("pay-open-note")).to_be_visible(timeout=10_000)
    expect(page.get_by_test_id("pay-submit")).to_be_disabled()


def test_locked_spheres_show_cards_chakras_and_a_buy_button(page: Page):
    """Закрытые сферы пары — как закрытые разделы личного разбора: карты позиций, чакры под замком
    и кнопка «Открыть раздел — 250 ₽»."""
    calc_pair(page)
    locks = page.get_by_test_id("pair-locks")
    expect(locks.locator("[data-locked=true] .mpc").first).to_be_visible()
    expect(page.get_by_test_id("pair-lock-chakras").locator("[data-testid^=chakra-lock-]")).to_have_count(8)
    buy = page.locator("[data-testid^=pair-buy-]").first
    expect(buy).to_contain_text("390")
    buy.click()
    expect(page.get_by_test_id("plan-pair")).to_be_visible()
