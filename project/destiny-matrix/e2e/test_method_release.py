"""Приёмка единого релиза: один расчёт на главной, в покупке, отчёте и PDF."""
from __future__ import annotations

import re
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path

from playwright.sync_api import expect

import flows


def _position_values(page, section: str) -> list[int]:
    return page.get_by_test_id(f"section-{section}").locator("li[data-arcanum]").evaluate_all(
        "items => items.map(item => Number(item.dataset.arcanum))"
    )


def test_golden_date_is_identical_on_landing_paid_report_and_pdf(page, mail, tmp_path):
    flows.calculate(page, 31, 3, 1993, sex="m")

    expected_main = {
        "Центр карты": 4,
        "Портрет личности": 4,
        "Материальная задача": 22,
        "Кармическая задача": 11,
        "Вход денежной линии": 8,
        "Вход линии отношений": 15,
    }
    for label, value in expected_main.items():
        card = page.locator(f'.mpc[data-position="{label}"]')
        expect(card).to_have_attribute("data-arcanum", str(value))

    artifact_dir = os.environ.get("UNIFIED_RELEASE_ARTIFACT_DIR")
    if artifact_dir:
        target = Path(artifact_dir)
        target.mkdir(parents=True, exist_ok=True)
        page.locator("#result").screenshot(path=str(target / "31-03-1993-landing.png"))

    flows.open_pay(page)
    assert flows.pay(page, mail) == ""
    matrix_id = flows.matrix_ids(page)[0]
    page.goto(f"{page.url.split('/account')[0]}/report?m={matrix_id}", wait_until="networkidle")

    assert _position_values(page, "past_lives") == [15, 8, 11]
    assert _position_values(page, "profession") == [3, 10, 7]
    assert _position_values(page, "money")[:3] == [8, 13, 5]
    assert _position_values(page, "relations")[:3] == [15, 20, 5]
    assert page.locator("[data-locked=true]").count() == 0
    tail_link = page.get_by_test_id("section-past_lives").locator(".encref a")
    expect(tail_link).to_have_attribute("href", "/encyclopedia/karmic-tail/15-8-11")
    expect(tail_link).to_have_attribute("data-entity-type", "karmic_tail")
    comfort_link = page.get_by_test_id("section-comfort").locator(".encref a")
    expect(comfort_link).to_have_attribute("href", "/encyclopedia/position/comfort")
    expect(comfort_link).to_have_attribute("data-entity-type", "position")
    if artifact_dir:
        page.locator("main").screenshot(path=str(Path(artifact_dir) / "31-03-1993-report.png"))

    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)
    with page.expect_response(
        lambda response: response.url.endswith("/api/reports/pdf") and response.status == 200,
        timeout=180_000,
    ) as response_info:
        button.click()
    answer = response_info.value.json()
    page.wait_for_function(
        "() => document.querySelector('[data-testid=save-pdf]').innerText.includes('Открыть')",
        timeout=180_000,
    )

    pdf_path = tmp_path / "31-03-1993-m.pdf"
    with urllib.request.urlopen(answer["url"], timeout=60) as source:
        pdf_path.write_bytes(source.read())
    assert pdf_path.read_bytes().startswith(b"%PDF")
    if artifact_dir:
        shutil.copyfile(pdf_path, Path(artifact_dir) / "31-03-1993-report.pdf")
    extracted = subprocess.run(
        ["pdftotext", "-layout", str(pdf_path), "-"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    flat = re.sub(r"\s+", " ", extracted)
    # Letter-spacing в подписях карточек заставляет pdftotext вставлять пробелы внутри слов.
    # Для текстового oracle это один визуальный заголовок, поэтому сравниваем без whitespace.
    compact = re.sub(r"\s+", "", extracted).lower()
    for text in (
        "31 марта 1993",
        "Вход линии отношений и хвоста",
        "Средняя точка хвоста",
        "Кармическая задача",
        "Вход денежной линии",
        "Денежное направление",
    ):
        assert re.sub(r"\s+", "", text).lower() in compact, f"в PDF нет «{text}»"

    tail = compact.split("задачипрошлыхвоплощений", 1)[1].split("вашепредназначение", 1)[0]
    for value in ("15дьявол", "8сила", "11справедливость"):
        assert value in tail, f"в PDF-хвосте нет «{value}»"
