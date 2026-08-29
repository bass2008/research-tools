"""Цикл 9, ступень 1: печать, расчёт без скриптов, справочник. Раунд 4.

Тесты написаны до правок и падали по существу дефекта.
"""
from __future__ import annotations

import re
import uuid

import pytest
from playwright.sync_api import Page

import flows
from conftest import BASE

pytestmark = pytest.mark.bug


def test_links_inside_the_printed_report_point_at_the_public_site(page: Page):
    """Печать открывается по внутреннему адресу http://web:3000, и все ссылки в PDF вели туда же —
    у покупателя они не открываются."""
    mail = f"agent-print-{uuid.uuid4().hex[:8]}@example.com"
    flows.buy(page, mail, 14, 6, 1987)
    page.wait_for_timeout(800)
    ids = flows.matrix_ids(page)
    assert ids, "матрица не сохранилась"

    page.goto(f"{BASE}/report?m={max(ids)}", wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    hrefs = page.locator("main a[href]").evaluate_all(
        "els => els.map(e => e.getAttribute('href'))")
    inner = [h for h in hrefs if h and "web:3000" in h]
    assert not inner, f"{len(inner)} ссылок ведут на внутренний адрес"


def test_calculator_without_scripts_explains_itself(page: Page):
    """Без скриптов кнопка навсегда оставалась надписью «Секунду, готовим расчёт…»: обещание,
    которое никогда не исполнится."""
    context = page.context.browser.new_context(java_script_enabled=False)
    try:
        blank = context.new_page()
        blank.goto(BASE, wait_until="domcontentloaded")
        text = blank.inner_text("body")
        assert "JavaScript" in text or "скрипт" in text.lower(), (
            "страница без скриптов не объясняет, почему расчёт не работает"
        )
    finally:
        context.close()


def test_tail_permutation_redirects_to_the_canonical_address(page: Page):
    """Перестановка тройки уезжает на канонический адрес постоянным редиректом.

    Метки перехода (utm, yclid) при этом не переносятся: чтобы их прочитать, страница должна
    принимать searchParams, а от этого маршрут перестаёт быть статическим — и неизвестная
    тройка начинает отдавать 404 с пустым телом и заголовком главной. Выбран корректный 404.
    """
    res = page.request.get(
        f"{BASE}/encyclopedia/karmic-tail/9-9-18?utm_source=test",
        max_redirects=0,
    )
    assert res.status in (301, 308), f"код {res.status}"
    assert "/encyclopedia/karmic-tail/" in res.headers.get("location", "")


def test_unknown_tail_gives_a_readable_404(page: Page):
    """Тройка вне списка отдавала 404 с заголовком главной и пустым телом."""
    res = page.request.get(f"{BASE}/encyclopedia/karmic-tail/7-7-7")
    assert res.status == 404
    body = re.sub(r"<script.*?</script>", "", res.text(), flags=re.S)
    assert "Такой страницы нет" in body
    title = re.search(r"<title>([^<]*)</title>", res.text())
    assert title and "не найдена" in title.group(1)


def test_all_combinations_link_opens_the_combinations_tab(page: Page):
    """Ссылка «Все сочетания N аркана» открывала вкладку «Значение», где списка сочетаний нет."""
    page.goto(f"{BASE}/encyclopedia/combination/1-6", wait_until="domcontentloaded")
    page.wait_for_timeout(600)
    page.get_by_role("link", name=re.compile(r"Все сочетания 6 аркана")).first.click()
    page.wait_for_url("**/encyclopedia/arcanum/**")
    page.wait_for_timeout(900)
    active = page.evaluate(
        """() => {
          const on = document.querySelector('.tab.on, .tabbar .on');
          return on ? on.textContent.trim() : null;
        }"""
    )
    assert active and "очетани" in active, f"открыта вкладка «{active}»"


def test_free_report_does_not_repeat_the_same_paragraph(page: Page):
    """Две позиции с одним арканом печатали один и тот же абзац дословно."""
    flows.calculate(page, 14, 5, 1970, sex="f")
    page.goto(f"{BASE}/report", wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    texts = page.locator(".postext").all_inner_texts()
    long_texts = [t.strip() for t in texts if len(t.strip()) > 60]
    assert len(long_texts) == len(set(long_texts)), "абзац толкования повторяется дословно"


def test_hero_heading_stays_visible_after_the_slide_changes(page: Page):
    """Единственный h1 главной жил на первом слайде: после переключения он оказывался внутри
    aria-hidden и inert."""
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector(".pips button")
    page.locator(".pips button").nth(2).click()
    page.wait_for_timeout(900)
    hidden = page.evaluate(
        """() => {
          const h = document.querySelector('h1');
          if (!h) return 'нет h1';
          return h.closest('[inert], [aria-hidden="true"]') ? 'скрыт' : 'виден';
        }"""
    )
    assert hidden == "виден", f"после смены слайда заголовок {hidden}"
