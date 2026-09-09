"""Почта в живых формах: отказ приходит до запроса и говорит, что именно исправить.

Дефект 8 сентября 2026: покупатель ввёл `tatyana123.@mail.ru`, форма отправила запрос,
сервер ответил 422, а под кнопкой появилось «Проверьте почту» — что не так с адресом, человек
не понял и ушёл. Платёж при этом не начинался вовсе.
"""
from __future__ import annotations

import json
import pathlib

from playwright.sync_api import expect

import flows
from conftest import BASE

BROKEN = "tatyana123.@mail.ru"
CASES = json.loads(
    (pathlib.Path(__file__).resolve().parents[1] / "spec" / "email-cases.json")
    .read_text(encoding="utf-8")
)


def watch_api(page):
    """Список путей API, которые страница дёрнула: проверяем, что отказ случился без сети."""
    seen: list[str] = []
    page.on("request", lambda r: seen.append(r.url) if "/api/" in r.url else None)
    return seen


def api_calls(seen: list[str], *fragments: str) -> list[str]:
    return [u for u in seen if any(f in u for f in fragments)]


def test_pay_refuses_dot_before_at_without_asking_the_server(page):
    flows.calculate(page, 31, 3, 1993, "f")
    flows.open_pay(page)
    seen = watch_api(page)

    page.get_by_test_id("pay-email").fill(BROKEN)
    page.get_by_test_id("pay-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    page.wait_for_timeout(800)

    expect(page.locator(".err")).to_be_visible()
    assert api_calls(seen, "/auth/register", "/payments/") == [], "форма всё-таки ушла в сеть"


def test_pay_error_names_the_dot(page):
    flows.calculate(page, 31, 3, 1993, "f")
    flows.open_pay(page)
    page.get_by_test_id("pay-email").fill(BROKEN)
    page.get_by_test_id("pay-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    page.wait_for_timeout(800)

    text = page.locator(".err").first.inner_text()
    assert "точка" in text.lower(), text
    assert "деньги не списаны" not in text, "про деньги говорить нечего: платёж не начинался"


def test_pay_after_fixing_the_address_goes_through(page, mail):
    """Исправил адрес — покупка проходит в том же открытом окне, без перезагрузки."""
    flows.calculate(page, 31, 3, 1993, "f")
    flows.open_pay(page)
    page.get_by_test_id("pay-email").fill(BROKEN)
    page.get_by_test_id("pay-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    page.wait_for_timeout(600)
    expect(page.locator(".err")).to_be_visible()

    page.get_by_test_id("pay-email").fill(mail)
    page.get_by_test_id("pay-submit").click()
    page.wait_for_function(
        """() => document.querySelector('[data-testid=paid-matrix]')
                || document.querySelector('.err')""",
        timeout=60_000)
    expect(page.get_by_test_id("paid-matrix")).to_be_visible()


def test_pay_accepts_address_pasted_with_spaces_and_capitals(page, mail):
    """Копипаст из письма: пробелы по краям и верхний регистр чинятся сами, а не отказом."""
    flows.calculate(page, 31, 3, 1993, "f")
    flows.open_pay(page)
    error = flows.pay(page, f"  {mail.upper()}  ")
    assert error == "", error
    expect(page.get_by_test_id("paid-matrix")).to_be_visible()


def test_pay_accepts_address_with_invisible_character(page, mail):
    """Ноль-ширинный пробел приезжает копипастом из мессенджера; сервер такой адрес отвергает."""
    flows.calculate(page, 31, 3, 1993, "f")
    flows.open_pay(page)
    error = flows.pay(page, mail.replace("@", "​@"))
    assert error == "", error
    expect(page.get_by_test_id("paid-matrix")).to_be_visible()


def test_register_refuses_dot_before_at_without_asking_the_server(page):
    page.goto(f"{BASE}/register", wait_until="domcontentloaded")
    page.wait_for_timeout(600)
    seen = watch_api(page)

    page.get_by_test_id("auth-email").fill(BROKEN)
    page.get_by_test_id("auth-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    page.wait_for_timeout(800)

    assert "точка" in page.locator(".err").first.inner_text().lower()
    assert api_calls(seen, "/auth/register") == [], "регистрация ушла в сеть с битым адресом"


def test_login_refuses_dot_before_at(page):
    page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    page.wait_for_timeout(600)
    seen = watch_api(page)

    page.get_by_test_id("auth-email").fill(BROKEN)
    page.get_by_test_id("auth-password").fill("1234")
    page.get_by_test_id("auth-submit").click()
    page.wait_for_timeout(800)

    assert "точка" in page.locator(".err").first.inner_text().lower()
    assert api_calls(seen, "/auth/login") == []


def test_forgot_refuses_dot_before_at(page):
    page.goto(f"{BASE}/forgot", wait_until="domcontentloaded")
    page.wait_for_timeout(600)
    seen = watch_api(page)

    page.get_by_test_id("forgot-email").fill(BROKEN)
    page.get_by_test_id("forgot-submit").click()
    page.wait_for_timeout(800)

    assert "точка" in page.locator(".err").first.inner_text().lower()
    assert api_calls(seen, "/reset/request") == []


def test_pay_form_refuses_every_broken_address_from_the_corpus(page):
    """Весь корпус разом в одной открытой форме: каждый отказ — до запроса и с текстом."""
    flows.calculate(page, 31, 3, 1993, "f")
    flows.open_pay(page)
    page.get_by_test_id("pay-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    seen = watch_api(page)

    for case in CASES["invalid"]:
        value = case["value"]
        if not value:
            continue
        page.get_by_test_id("pay-email").fill(value)
        page.get_by_test_id("pay-submit").click()
        page.wait_for_timeout(120)
        assert page.locator(".err").count(), f"нет отказа на {value!r}"
        assert page.locator(".err").first.inner_text().strip(), f"пустой отказ на {value!r}"

    assert api_calls(seen, "/auth/register", "/payments/") == [], "часть адресов ушла в сеть"


def test_server_refusal_still_reaches_the_person(page):
    """Если клиент и сервер разойдутся, отказ сервера обязан дойти словами, а не пустотой:
    именно так 8 сентября выглядел отказ 422 — «Проверьте почту» под кнопкой."""
    flows.calculate(page, 31, 3, 1993, "f")
    flows.open_pay(page)
    page.route(
        "**/api/auth/register",
        lambda route: route.fulfill(
            status=422,
            content_type="application/json",
            body='{"detail": "Проверьте почту. почта — в виде you@mail.ru, не длиннее 200 знаков."}',
        ),
    )

    page.get_by_test_id("pay-email").fill("someone@mail.ru")
    page.get_by_test_id("pay-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    page.wait_for_timeout(1500)

    text = page.locator(".err").first.inner_text()
    assert "Проверьте почту" in text, text
    assert "деньги не списаны" in text, "про деньги надо сказать: запрос ушёл"
    assert page.get_by_test_id("paid-matrix").count() == 0


def test_pay_refuses_typo_in_the_domain_tail_without_asking_the_server(page):
    """Находка цикла 16: опечатка в хвосте домена (`mail.ru2`) проходила клиентскую проверку,
    сервер отвечал 422, и человек читал «Проверьте почту. почта — в виде you@mail.ru» на адресе,
    который как раз в этом виде."""
    flows.calculate(page, 31, 3, 1993, "f")
    flows.open_pay(page)
    seen = watch_api(page)

    page.get_by_test_id("pay-email").fill("tatyana@mail.ru2")
    page.get_by_test_id("pay-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click()
    page.wait_for_timeout(800)

    text = page.locator(".err").first.inner_text()
    assert "буквой" in text or "хвост" in text, text
    assert api_calls(seen, "/auth/register", "/payments/") == [], "адрес ушёл в сеть"


def test_register_refuses_service_domain(page):
    """Адрес рабочей машины (`.local`) или из примера в инструкции (`.test`) письма не получит —
    сервер такие домены отвергает, значит и форма обязана сказать это до запроса."""
    page.goto(f"{BASE}/register", wait_until="domcontentloaded")
    page.wait_for_timeout(600)
    seen = watch_api(page)

    page.get_by_test_id("auth-email").fill("ivan@pc.local")
    page.get_by_test_id("auth-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    page.wait_for_timeout(800)

    assert "не доходят" in page.locator(".err").first.inner_text()
    assert api_calls(seen, "/auth/register") == []
