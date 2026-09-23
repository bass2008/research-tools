"""Печать разбора на живом контуре — та проверка, которой не было 23.09.2026.

В тот день боевой русский контур напечатал ноль отчётов: сервисы переименовали в `ru-*`, а api
продолжал звать браузер по имени `browser`, которого в его сети нет. Покупатель заплатил, трижды
нажал «Сохранить как PDF» и трижды получил ошибку; в логах — `Name or service not known`.
Прогоны той сборки были зелёными, потому что печать проверялась только на общем стенде, где оба
контура сидят в сети печати и имя разрешается.

Тест языконезависим: кнопки ищутся по `data-testid`, а путь до разбора выбирается по тому, есть
ли на контуре касса. Гонять против тестового домена — боевую базу засорять нечем:

    E2E_URL=https://test.arcana-sense.ru  pytest e2e/test_print_contour.py
    E2E_URL=https://test.arcana-sense.com pytest e2e/test_print_contour.py
"""
from __future__ import annotations

import io
import urllib.request
import uuid

from pypdf import PdfReader

import pytest
from playwright.sync_api import Page, expect

import flows
from conftest import BASE, _credentials


def _register(page: Page) -> str:
    mail = f"print-{uuid.uuid4().hex[:8]}@example.com"
    page.goto(f"{BASE}/register", wait_until="domcontentloaded")
    page.get_by_test_id("auth-email").fill(mail)
    page.get_by_test_id("auth-password").fill("1234")
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("auth-submit").click()
    page.wait_for_url(f"{BASE}/account", timeout=20_000)
    return mail


def _matrix_for_report(page: Page) -> int:
    """Разбор, который можно печатать: на контуре с кассой — купленный, иначе — просто сохранённый."""
    page.goto(BASE, wait_until="domcontentloaded")
    paid_contour = page.get_by_test_id("buy-top").count() > 0

    if paid_contour:
        # На контуре с кассой доступ берётся деньгами: тестовая карта банка, как у человека.
        flows.buy_on_bank(page, f"print-{uuid.uuid4().hex[:8]}@example.com", 8, 8, 1998)
    else:
        _register(page)
        # Матрица заводится запросом, а не кнопкой: путь через «сохранить» на витрине без кассы
        # сейчас обрывается своей ошибкой, и печать за ней было бы не видно.
        answer = page.request.post(f"{BASE}/api/matrices",
                                   data={"birth": "1998-08-08", "sex": "m"})
        assert answer.status in (200, 201), f"матрица не создалась: {answer.status} {answer.text()[:200]}"

    listed = page.request.get(f"{BASE}/api/matrices")
    assert listed.status == 200, f"список матриц: {listed.status}"
    items = listed.json()["items"]
    assert items, "после покупки или сохранения список матриц пуст"
    return items[0]["id"]


def test_report_prints_on_this_contour(page: Page):
    matrix_id = _matrix_for_report(page)
    page.goto(f"{BASE}/report?m={matrix_id}", wait_until="domcontentloaded")

    answer: dict = {}
    failed: list[int] = []

    def catch(response):
        if not response.url.endswith("/api/reports/pdf"):
            return
        if response.status == 200:
            answer.update(response.json())
        else:
            failed.append(response.status)

    page.on("response", catch)

    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)
    button.click()

    # Ждём любого исхода: готового файла или надписи об ошибке. Без второй ветки сломанная печать
    # выглядела бы как медленная — тест висел бы до таймаута и не сказал, что именно не так.
    page.wait_for_function(
        """() => document.querySelector('[data-testid=save-pdf]')?.getAttribute('aria-busy') !== 'true'""",
        timeout=180_000)

    note = page.locator(".pdfnote, .err")
    assert not failed, (
        f"печать ответила {failed[0]}: "
        f"{note.first.inner_text().strip() if note.count() else 'без пояснения'}. "
        "Обычно это недоступный контейнер браузера: проверьте BROWSER_URL и сеть контура"
    )
    assert answer.get("status") == "done", f"печать не дошла до готового файла: {answer}"

    url = answer.get("url", "")
    assert url.startswith("http"), url
    opener = urllib.request.build_opener()
    credentials = _credentials()
    if credentials and url.startswith(BASE):
        import base64
        token = base64.b64encode(
            f"{credentials['username']}:{credentials['password']}".encode()).decode()
        opener.addheaders = [("Authorization", f"Basic {token}")]
    with opener.open(url, timeout=60) as file:
        body = file.read()
    assert body.startswith(b"%PDF"), "по ссылке лежит не PDF"

    # Главное — что напечатали. Задача печати считает работу удачной по факту готового файла, а
    # внутри может лежать страница «Такой страницы нет»: браузер открывал чужой контур, тот про
    # эту матрицу не знал и отдавал 404. Размер и статус такой файл проходит, человек — нет.
    reader = PdfReader(io.BytesIO(body))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    for missing in ("Такой страницы нет", "This page does not exist"):
        assert missing not in text, f"напечатана страница ошибки вместо разбора: «{missing}»"
    assert "1998" in text, "в отчёте нет даты, по которой его печатали"
