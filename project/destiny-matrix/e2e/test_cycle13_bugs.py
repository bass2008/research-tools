"""Цикл 13, ступень 1: цель платежа, доступ после переключения пола, ссылки кабинета и PDF."""
from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

import flows
from conftest import BASE

pytestmark = pytest.mark.bug


def test_buy_button_on_a_matrix_page_pays_for_that_matrix(page: Page, mail: str) -> None:
    """Кнопка «Купить» в шапке на странице конкретной даты открывает именно её.

    Ссылка шапки вела на голый `/pay`, а тот выбирал цель из даты в браузере: на странице
    сохранённой закрытой даты платёж уходил за другую дату.
    """
    flows.register(page, mail)
    flows.calculate(page, 19, 11, 1975, "f")
    flows.save_current(page)
    closed_id = flows.matrix_ids(page)[0]
    # дата в браузере теперь другая — именно она перебивала цель платежа
    flows.calculate(page, 2, 5, 2001, "m")

    page.goto(f"{BASE}/matrices/{closed_id}", wait_until="domcontentloaded")
    page.get_by_test_id("buy-top").click()
    expect(page.get_by_test_id("pay-target")).to_have_value(str(closed_id), timeout=15_000)


def test_sex_switch_keeps_the_paid_report_open(page: Page, mail: str) -> None:
    """Пол не меняет ни одного числа карты, поэтому не должен закрывать оплаченный разбор.

    Право искалось по паре «дата + пол», и переключатель под датой возвращал оплаченную дату под
    18 замков. `/report` при этом открывался, поэтому проверяем именно блок на главной.
    """
    flows.buy(page, mail, 22, 11, 1993, sex="m")
    flows.calculate(page, 22, 11, 1993, "m")
    page.wait_for_timeout(2500)
    assert flows.locked_sections(page) == 0, "сразу после покупки разделы под замком"

    flows.calculate(page, 22, 11, 1993, "f")
    page.wait_for_timeout(2500)
    locked = flows.locked_sections(page)
    assert locked == 0, f"после переключения пола под замком {locked} разделов из 20"


def test_account_report_link_opens_the_paid_matrix(page: Page, mail: str) -> None:
    """«Мой разбор» в кабинете ведёт на купленную дату, а не на последнюю сохранённую."""
    flows.buy(page, mail, 19, 9, 1979, sex="f")
    flows.calculate(page, 5, 5, 2015, "f")
    flows.save_current(page)
    flows.account(page)
    href = page.get_by_test_id("account-report").get_attribute("href")
    page.get_by_test_id("account-report").click()
    page.wait_for_timeout(1200)
    locked = flows.locked_sections(page)
    assert locked == 0, f"«Мой разбор» ведёт на закрытую дату ({href}), под замком {locked} разделов"


def test_printed_report_has_no_container_host_links(page: Page, mail: str, tmp_path) -> None:
    """В PDF не должно быть ссылок на внутреннее имя контейнера: снаружи `web:3000` не существует."""
    import urllib.request

    from pypdf import PdfReader

    flows.buy(page, mail, 27, 8, 2001)
    page.goto(f"{BASE}/report", wait_until="domcontentloaded")
    page.wait_for_timeout(900)
    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)
    with page.expect_response(
        lambda response: response.url.endswith("/api/reports/pdf") and response.status == 200,
        timeout=180_000,
    ) as info:
        button.click()
    path = tmp_path / "report.pdf"
    with urllib.request.urlopen(info.value.json()["url"], timeout=60) as source:
        path.write_bytes(source.read())

    reader = PdfReader(str(path))
    urls: list[str] = []
    for sheet in reader.pages:
        for raw in sheet.get("/Annots") or []:
            action = raw.get_object().get("/A") or {}
            uri = action.get("/URI")
            if uri:
                urls.append(str(uri))
    bad = sorted({u for u in urls if re.search(r"//web(:\d+)?/", u)})
    assert not bad, f"в PDF {len(bad)} ссылок на внутренний адрес контейнера: {bad[:3]}"


def test_personal_reading_is_closed_from_indexing_by_header(page: Page) -> None:
    """Директива для робота не должна зависеть от того, где в документе оказался тег.

    У динамических маршрутов Next отдаёт метаданные стримом, то есть уже в `<body>`: обходчик,
    который не исполняет скрипты, `noindex` в разметке не видел.
    """
    response = page.request.get(f"{BASE}/encyclopedia/money/8-13-5-8")
    assert response.status == 200
    tag = response.headers.get("x-robots-tag", "")
    assert "noindex" in tag, f"нет заголовка X-Robots-Tag: {response.headers}"

    # Разметку проверяем от лица обходчика: для него стрим метаданных выключен настройкой
    # `htmlLimitedBots`, поэтому место тега детерминировано.
    crawler = page.request.get(
        f"{BASE}/encyclopedia/money/8-13-5-8",
        headers={"User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"},
    )
    head = crawler.text().split("</head>", 1)[0]
    for needle in ("noindex", 'rel="canonical"', "<title"):
        assert needle in head, f"«{needle}» приезжает после </head>"


def test_year_line_without_birth_has_a_clean_description(page: Page) -> None:
    """Без параметра `birth` линия отдаётся без персонального возраста — и описание тоже."""
    response = page.request.get(f"{BASE}/encyclopedia/years/4-7-3-7-22-6-11-15")
    assert response.status == 200
    head = response.text().split("</head>", 1)[0]
    assert "undefined" not in head, "в метаданных осталось служебное значение"
    assert "NaN" not in head


def test_not_found_page_uses_site_fonts(page: Page) -> None:
    """404 набиралась запасными шрифтами: свой документ не получал переменных next/font."""
    page.goto(f"{BASE}/nosuchpage", wait_until="networkidle")
    classes = page.evaluate("document.documentElement.className")
    assert "__variable" in classes, f"на 404 нет шрифтовых переменных: «{classes}»"
    loaded = page.evaluate("document.fonts.size")
    assert loaded > 0, "ни одного шрифта сайта не загружено"
