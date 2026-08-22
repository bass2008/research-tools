"""Разбор в PDF и админка."""
from __future__ import annotations

import urllib.request

from playwright.sync_api import expect

import flows
from conftest import ADMIN, BASE


def test_pdf_is_generated_and_downloads(page, mail):
    flows.buy(page, mail, 8, 8, 1998)
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(1200)

    answer: dict = {}
    page.on("response", lambda r: answer.update(r.json())
            if r.url.endswith("/api/reports/pdf") and r.status == 200 else None)

    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)      # до гидратации кнопка выключена
    button.click()
    # состояние ловим ожиданием, а не таймером: печать иногда успевает закончиться раньше
    page.wait_for_function(
        """() => { const b = document.querySelector('[data-testid=save-pdf]');
                   return b.innerText.includes('Готовим') || b.innerText.includes('Открыть'); }""",
        timeout=30_000)
    if "Готовим" in button.inner_text():
        assert button.is_disabled(), "кнопка активна во время печати"
    page.wait_for_function(
        "() => document.querySelector('[data-testid=save-pdf]').innerText.includes('Открыть')",
        timeout=180_000)

    assert answer.get("status") == "done", answer
    url = answer.get("url", "")
    assert url.startswith("http"), url
    with urllib.request.urlopen(url, timeout=60) as answer:
        head = answer.read(5)
        assert head.startswith(b"%PDF"), head


def test_admin_sees_lists_and_stranger_does_not(page, mail):
    flows.buy(page, mail, 9, 9, 1999)
    page.get_by_test_id("logout").click()
    page.wait_for_timeout(600)

    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    expect(page.get_by_test_id("admin-users")).to_be_visible()
    expect(page.get_by_test_id("admin-payments")).to_contain_text(mail)
    expect(page.get_by_test_id("admin-reports")).to_be_visible()

    page.get_by_test_id("logout").click()
    page.wait_for_timeout(600)
    flows.login(page, mail)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    page.wait_for_timeout(1200)
    assert page.get_by_test_id("admin-users").count() == 0, "посторонний увидел админку"


def test_second_click_returns_the_same_file(page, mail):
    """Повторное нажатие не печатает заново: сервер отдаёт готовый файл."""
    answers: list[dict] = []
    page.on("response", lambda r: answers.append(r.json())
            if r.url.endswith("/api/reports/pdf") and r.status == 200 else None)

    flows.buy(page, mail, 12, 11, 1993)
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(1200)
    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)
    button.click()
    page.wait_for_function(
        "() => document.querySelector('[data-testid=save-pdf]').innerText.includes('Открыть')",
        timeout=180_000)

    page.reload()
    page.wait_for_timeout(1500)
    again = page.get_by_test_id("save-pdf")
    expect(again).to_be_enabled(timeout=20_000)
    again.click()
    page.wait_for_function(
        "() => document.querySelector('[data-testid=save-pdf]').innerText.includes('Открыть')",
        timeout=60_000)

    assert len(answers) == 2, answers
    assert answers[0]["cached"] is False and answers[1]["cached"] is True, answers
    assert answers[0]["url"].split("?")[0] == answers[1]["url"].split("?")[0]


def test_pdf_holds_the_paid_report(page, mail):
    """В файле есть карты и объём: пустой PDF не должен считаться успехом."""
    answer: dict = {}
    page.on("response", lambda r: answer.update(r.json())
            if r.url.endswith("/api/reports/pdf") and r.status == 200 else None)

    flows.buy(page, mail, 13, 12, 1994)
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(1200)
    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)
    button.click()
    page.wait_for_function(
        "() => document.querySelector('[data-testid=save-pdf]').innerText.includes('Открыть')",
        timeout=180_000)

    import re
    import urllib.request
    with urllib.request.urlopen(answer["url"], timeout=90) as file:
        pdf = file.read()
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 1_000_000, f"файл подозрительно маленький: {len(pdf)} Б"
    assert len(re.findall(rb"/Subtype\s*/Image", pdf)) >= 20, "в файле нет карт арканов"
