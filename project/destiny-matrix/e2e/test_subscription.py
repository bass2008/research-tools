"""Подписка открывает весь сайт без предложений оплаты; админ выдаёт пару и подписку кому угодно."""
from __future__ import annotations

import re

import flows
from conftest import ADMIN, BASE
from flows import calculate, pay
from playwright.sync_api import Page, expect
from test_admin_actions import open_actions
from test_pair import PAID_TEXTS, calc_pair

PAGES = ["/", "/report", "/matrix", "/matrix/14-6-7", "/encyclopedia/chakra/energy-field",
         "/encyclopedia/arcanum/1", "/encyclopedia/karmic-tail", "/compatibility"]


def subscribe(page: Page, mail: str) -> None:
    page.goto(f"{BASE}/pay/month", wait_until="domcontentloaded")
    assert pay(page, mail) == ""


def test_subscriber_is_offered_nothing_and_sees_everything(page: Page, mail: str):
    subscribe(page, mail)
    calculate(page, 3, 4, 1977, "f")
    expect(page.locator("#result [data-locked=true]")).to_have_count(0)

    for path in PAGES:
        page.goto(BASE + path, wait_until="networkidle")
        expect(page.locator("a[href^='/ru/pay']"), path).to_have_count(0)
        expect(page.get_by_role("button", name=re.compile("Купить"))).to_have_count(0)
        expect(page.locator("main, #content").first, path).not_to_contain_text("₽")

    page.goto(f"{BASE}/report", wait_until="networkidle")
    expect(page.locator("[data-locked=true]")).to_have_count(0)
    expect(page.locator("details.acc")).to_have_count(20)


def test_subscriber_reads_the_whole_pair_in_the_calculator(page: Page, mail: str):
    subscribe(page, mail)
    calc_pair(page)
    expect(page.get_by_test_id("pair-report")).to_have_attribute("data-mode", "full")
    expect(page.get_by_test_id("pair-locks")).to_have_count(0)
    assert any(text in page.content() for text in PAID_TEXTS), "подписчик не видит полных текстов пары"
    page.get_by_test_id("pair-open").click()
    page.wait_for_url(re.compile(r"/readings/\d+"))
    expect(page.get_by_test_id("save-pdf")).to_be_visible()


def test_second_subscription_is_not_sold(page: Page, mail: str):
    subscribe(page, mail)
    for path in ("/pay", "/pay/pair", "/pay/month"):
        page.goto(BASE + path, wait_until="networkidle")
        expect(page.get_by_test_id("pay-subscribed"), path).to_be_visible()
        expect(page.get_by_test_id("pay-submit"), path).to_have_count(0)


def test_admin_grants_a_pair_and_a_subscription(page: Page, mail: str):
    flows.register(page, mail)
    flows.logout(page)
    flows.login(page, *ADMIN)

    open_actions(page, mail)
    page.get_by_test_id("action-grant-pair").click()
    dialog = page.get_by_test_id("grant-pair-dialog")
    dialog.get_by_test_id("grant-pair-a-year").select_option("1993")
    dialog.get_by_test_id("grant-pair-a-month").select_option("3")
    dialog.get_by_test_id("grant-pair-a-day").select_option("31")
    dialog.get_by_test_id("grant-pair-b-year").select_option("1994")
    dialog.get_by_test_id("grant-pair-b-month").select_option("12")
    dialog.get_by_test_id("grant-pair-b-day").select_option("28")
    dialog.get_by_test_id("grant-pair-submit").click()
    expect(page.get_by_test_id("grant-pair-done")).to_be_visible()
    expect(page.get_by_test_id("grant-pair-done")).not_to_contain_text("Пара Пара")

    open_actions(page, mail)
    page.get_by_test_id("action-grant-subscription").click()
    expect(page.get_by_test_id("grant-subscription-done")).to_contain_text("Подписка действует до")

    flows.logout(page)
    flows.login(page, mail)
    access = page.get_by_test_id("account-access")
    expect(access).to_contain_text("выдана")
    expect(access).not_to_contain_text("₽")
    card = page.get_by_test_id("pair-card")
    expect(card).to_have_count(1)
    expect(card.get_by_test_id("access-badge")).to_have_text("Выдана")
    card.get_by_role("link").first.click()
    page.wait_for_url(re.compile(r"/readings/\d+"))
    expect(page.get_by_test_id("pair-report")).to_have_attribute("data-mode", "full")
    expect(page.get_by_test_id("buy-top")).to_have_count(0)


def test_admin_sees_a_pair_buyer_and_grants_over_the_purchase(page: Page, mail: str):
    calc_pair(page)
    flows.open_pair_pay(page)
    assert pay(page, mail) == ""
    flows.logout(page)
    flows.login(page, *ADMIN)

    row = open_actions(page, mail)
    expect(row).to_contain_text("Куплено навсегда: 1 пара")
    page.get_by_test_id("action-grant-pair").click()
    dialog = page.get_by_test_id("grant-pair-dialog")
    dialog.get_by_test_id("grant-pair-a-year").select_option("1994")
    dialog.get_by_test_id("grant-pair-a-month").select_option("12")
    dialog.get_by_test_id("grant-pair-a-day").select_option("28")
    dialog.get_by_test_id("grant-pair-b-year").select_option("1993")
    dialog.get_by_test_id("grant-pair-b-month").select_option("3")
    dialog.get_by_test_id("grant-pair-b-day").select_option("31")
    dialog.get_by_test_id("grant-pair-submit").click()
    expect(page.get_by_test_id("grant-pair-done")).to_contain_text("добавлена и открыта")
    expect(page.get_by_test_id("grant-pair-done")).not_to_contain_text("Пара Пара")


def test_access_line_names_granted_and_bought_rights_without_prices(page: Page, mail: str):
    """Аудит 09.10 (четвёртый): выданная дата шла с ценой 250 ₽, купленная пара — «не оплачен»."""
    calc_pair(page)
    flows.open_pair_pay(page)
    assert pay(page, mail) == ""
    page.goto(f"{BASE}/account", wait_until="networkidle")
    access = page.get_by_test_id("account-access")
    expect(access).to_have_text(re.compile(r"Куплено навсегда: 1 пара"))
    expect(access).not_to_contain_text("не оплачен")

    flows.logout(page)
    flows.login(page, *ADMIN)
    open_actions(page, mail)
    page.get_by_test_id("action-grant").click()
    dialog = page.get_by_test_id("grant-dialog")
    dialog.get_by_test_id("grant-day").select_option("8")
    dialog.get_by_test_id("grant-month").select_option("8")
    dialog.get_by_test_id("grant-year").select_option("1988")
    dialog.get_by_test_id("grant-submit").click()
    expect(page.get_by_test_id("grant-done")).to_be_visible()
    open_actions(page, mail)
    page.get_by_test_id("action-grant-subscription").click()
    expect(page.get_by_test_id("grant-subscription-done")).to_be_visible()

    page.locator("[data-testid=admin-user-row]", has_text=mail).first.get_by_role("link", name=mail).click()
    card = page.get_by_test_id("admin-user-access")
    expect(card).to_contain_text("выдана")
    expect(card).to_contain_text("Выдано: 1 дата")
    expect(card).to_contain_text("Куплено навсегда: 1 пара")

    flows.logout(page)
    flows.login(page, mail)
    access = page.get_by_test_id("account-access")
    expect(access).to_contain_text("Выдано: 1 дата")
    expect(access).to_contain_text("· выдана")
    expect(access).not_to_contain_text("₽")


def test_refund_dialog_says_what_really_happens_to_access(page: Page, mail: str):
    """Аудит 09.10 (шестой): окно обещало «разбор закроется», а выданная дата оставалась открытой."""
    flows.buy(page, mail, 11, 11, 1991)
    flows.logout(page)
    flows.login(page, *ADMIN)
    open_actions(page, mail)
    page.get_by_test_id("action-grant").click()
    dialog = page.get_by_test_id("grant-dialog")
    dialog.get_by_test_id("grant-day").select_option("11")
    dialog.get_by_test_id("grant-month").select_option("11")
    dialog.get_by_test_id("grant-year").select_option("1991")
    dialog.get_by_test_id("grant-sex-m").click()
    dialog.get_by_test_id("grant-submit").click()
    expect(page.get_by_test_id("grant-done")).to_be_visible()

    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    row = page.locator("[data-testid=admin-payment-row]", has_text=mail).first
    expect(row).to_be_visible(timeout=20_000)
    asked: list[str] = []
    page.once("dialog", lambda d: (asked.append(d.message), d.accept()))
    row.get_by_test_id("payment-actions").click()
    page.get_by_test_id("refund").click()
    expect(row).to_contain_text("возвращён", timeout=30_000)
    assert asked and "останется открытым: он выдан бесплатно" in asked[0], asked
    assert "закроется" not in asked[0], asked[0]


def test_subscriber_on_a_refunded_receipt_is_not_offered_anything(page: Page, mail: str):
    """Аудит 09.10 (седьмой): чек возвращённого платежа показывал подписчику тарифы и цены."""
    flows.buy(page, mail, 15, 5, 1975)
    receipt = page.url
    assert "paid=" in receipt, receipt
    flows.logout(page)
    flows.login(page, *ADMIN)
    open_actions(page, mail)
    page.get_by_test_id("action-grant-subscription").click()
    expect(page.get_by_test_id("grant-subscription-done")).to_be_visible()
    row = page.locator("[data-testid=admin-payment-row]", has_text=mail).first
    page.once("dialog", lambda d: d.accept())
    row.get_by_test_id("payment-actions").click()
    page.get_by_test_id("refund").click()
    expect(row).to_contain_text("возвращён", timeout=30_000)

    flows.logout(page)
    flows.login(page, mail)
    page.goto(receipt, wait_until="networkidle")
    expect(page.get_by_test_id("pay-subscribed")).to_be_visible()
    expect(page.get_by_test_id("pay-submit")).to_have_count(0)


def test_pair_form_explains_an_impossible_date_in_plain_words(page: Page):
    page.goto(f"{BASE}/compatibility", wait_until="domcontentloaded")
    expect(page.get_by_test_id("pair-submit")).to_be_enabled()
    page.get_by_test_id("pair-a-d").select_option("31")
    page.get_by_test_id("pair-a-m").select_option("2")
    page.get_by_test_id("pair-a-y").select_option("1993")
    page.get_by_test_id("pair-submit").click()
    expect(page.get_by_test_id("pair-form").get_by_role("alert")).to_have_text(
        "Первый партнёр: в этом месяце 28 дней — выберите другое число.")
