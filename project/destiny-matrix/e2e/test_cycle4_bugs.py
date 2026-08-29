"""Цикл 4: дефекты, найденные живым обходом правок SEO-скоупа.

Инварианты, которых не было: обещание формы сверяется с тем, что реально попадает в расчёт;
список ссылок сверяется с полным набором и с порядком чисел; обрезка текста — с границей слова.
"""
from __future__ import annotations

import re

import pytest
import requests
from playwright.sync_api import Page

from conftest import BASE

pytestmark = pytest.mark.bug

PROMO_PAGES = (
    "/encyclopedia/karmic-tail",
    "/encyclopedia/karmic-tail/18-9-9",
    "/na-god",
    "/na-god/7",
)


def _html(path: str) -> str:
    r = requests.get(f"{BASE}{path}", timeout=30)
    assert r.status_code == 200, f"{path} → {r.status_code}"
    return r.text


@pytest.mark.parametrize("path", PROMO_PAGES)
def test_calculator_promises_only_what_free_calculation_shows(path):
    """Форма обещала «покажет вашу тройку… бесплатно» и «Рассчитать свой год», а бесплатная карта
    тройку не подписывает (раздел «Задачи прошлых воплощений» платный), а расчёта персонального
    года в продукте нет вовсе. Обещание конкретного результата в подписи формы недопустимо."""
    html = _html(path)
    promo = re.search(r'data-testid="calc-promo".*?</div></div>', html, re.S)
    assert promo, f"{path}: формы расчёта нет"
    block = promo.group(0)
    for lie in ("покажет вашу тройку", "Тройка считается вместе с картой",
                "Персональный год считается от даты рождения",
                "Аркан года считается от даты рождения"):
        assert lie not in block, f"{path}: форма обещает то, чего расчёт не даёт — «{lie}»"


def test_year_pages_do_not_promise_a_calculation_that_does_not_exist():
    """Расчёта персонального года в движке нет: ни бесплатно, ни в платном разборе. Страницы
    «на год» не должны предлагать «рассчитать свой год»."""
    for path in ("/na-god", "/na-god/7", "/na-god/22"):
        html = _html(path)
        assert "Рассчитать свой год" not in html, f"{path}: обещан расчёт года"
        assert "Посмотреть свой персональный год" not in html, f"{path}: обещан персональный год"


def test_other_year_arcana_block_lists_all_of_them_in_order():
    """Список «Другие арканы года» строился по строковым ключам и обрезался на двенадцати:
    после «19» шла «2», а арканы 3–8 не попадали в блок вовсе."""
    html = _html("/na-god/7")
    links = re.findall(r'href="/na-god/(\d+)"', html)
    numbers = [int(n) for n in links]
    missing = [n for n in range(1, 23) if n != 7 and n not in numbers]
    assert not missing, f"в блоке нет арканов {missing}"
    block = re.search(r"Другие арканы года.*?</div>\s*</div>", html, re.S)
    assert block, "блок «Другие арканы года» не найден"
    order = [int(n) for n in re.findall(r'href="/na-god/(\d+)"', block.group(0))]
    assert order == sorted(order), f"порядок не по возрастанию: {order[:8]}"


def test_card_descriptions_are_cut_at_a_word_boundary():
    """Описания карточек обрезались ровно на 120 знаках — посередине слова: «для давно отло…».
    Критерий точный: показанный кусок должен совпадать с началом статьи и заканчиваться там, где
    в статье кончается слово."""
    import json
    import pathlib as _p

    root = _p.Path(__file__).resolve().parents[1] / "web/content"
    shorts = []
    for name in ("year-arcana.json", "karmic-tails.json"):
        for item in json.loads((root / name).read_text())["items"]:
            shorts.append(item["short"])

    broken = []
    for path in ("/na-god", "/encyclopedia/karmic-tail"):
        for shown in re.findall(r'class="ds">([^<]{40,})…', _html(path)):
            # источник ищем по точному префиксу: у разных статей начала совпадают, и поиск по
            # первым сорока знакам подсовывал чужой текст
            source = next((s for s in shorts if s.startswith(shown)), None)
            if source is None or len(source) <= len(shown):
                continue
            following = source[len(shown)]
            if following.isalnum():
                broken.append(f"{path}: «…{shown[-26:]}» + «{source[len(shown):len(shown) + 6]}»")
    assert not broken, "обрыв посередине слова:\n" + "\n".join(broken[:6])


def test_hub_breadcrumb_is_a_short_name_not_the_whole_headline():
    """В крошку подставлялся полный заголовок статьи: на телефоне три строки, и то же
    предложение стояло строкой ниже заголовком."""
    for path in ("/programmy", "/karmicheskaya-matrica", "/energii"):
        html = _html(path)
        crumbs = re.search(r'<p class="crumbs[^"]*">(.*?)</p>', html, re.S).group(1)
        crumb_text = re.sub(r"<[^>]+>", "", crumbs).strip()
        h1 = re.sub(r"<[^>]+>", "", re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S).group(1)).strip()
        last = crumb_text.split("/")[-1].strip()
        assert last != h1, f"{path}: крошка повторяет заголовок целиком"
        assert len(last) <= 32, f"{path}: крошка длиной {len(last)} знаков — «{last}»"


def test_arcanum_links_to_its_year_page_once():
    """Ссылка на «N на год» стояла дважды подряд: отдельным блоком и в связях."""
    html = _html("/encyclopedia/arcanum/7")
    assert html.count('href="/na-god/7"') == 1, f"ссылок на /na-god/7: {html.count('href=\"/na-god/7\"')}"


def test_tail_page_does_not_repeat_the_same_arcanum_link():
    """На тройке 18-9-9 в «Куда дальше» ссылка «9 · Отшельник» стояла дважды: список строился
    по числам тройки, а в ней два девятых аркана."""
    html = _html("/encyclopedia/karmic-tail/18-9-9")
    block = re.search(r"Куда дальше.*?</div>\s*</div>", html, re.S).group(0)
    links = re.findall(r'href="(/encyclopedia/arcanum/\d+)"', block)
    assert len(links) == len(set(links)), f"повторяющиеся ссылки: {links}"


@pytest.mark.parametrize(
    "expected",
    ("/encyclopedia/karmic-tail", "/na-god"),
)
def test_encyclopedia_leads_to_the_category_hubs(page: Page, expected):
    """Раньше страницы категорий находились только поиском; поиск со справочника убран, поэтому
    ссылка на каждый раздел обязана быть в самой навигации."""
    page.goto(f"{BASE}/encyclopedia", wait_until="domcontentloaded")
    page.wait_for_timeout(300)
    hrefs = page.eval_on_selector_all(
        "main a", "els => els.map(e => e.getAttribute('href'))"
    )
    assert expected in hrefs, f"на справочнике нет ссылки на {expected}"


def test_error_about_days_in_month_disappears_when_the_date_is_fixed(page: Page):
    """Красное «В этом месяце 28 дней» висело до уход со страницы, даже когда число исправлено."""
    page.goto(f"{BASE}/programmy", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="promo-submit"]:not([disabled])', timeout=20000)
    page.select_option("#pd", "31")
    page.select_option("#pm", "2")
    page.click('[data-testid="promo-submit"]')
    assert page.locator(".promo .err").count(), "сообщение об ошибке не появилось"
    page.select_option("#pd", "14")
    page.wait_for_timeout(300)
    assert not page.locator(".promo .err").count(), "сообщение осталось после исправления числа"


def test_promo_form_starts_from_the_date_already_calculated(page: Page):
    """Человек посчитал дату на главной, открыл статью, нажал в её форме «Рассчитать» — и карта
    подменилась датой по умолчанию (сегодня минус 30 лет). Форма обязана показывать ту дату,
    с которой человек уже работает."""
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])', timeout=15000)
    page.select_option("#d", "7")
    page.select_option("#m", "3")
    page.select_option("#y", "1990")
    page.click('[data-testid="calc-submit"]')
    page.wait_for_timeout(1200)

    page.goto(f"{BASE}/programmy", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="promo-submit"]:not([disabled])', timeout=20000)
    assert page.input_value("#pd") == "7", f"число в форме: {page.input_value('#pd')}"
    assert page.input_value("#pm") == "3", f"месяц в форме: {page.input_value('#pm')}"
    assert page.input_value("#py") == "1990", f"год в форме: {page.input_value('#py')}"


def test_full_report_link_does_not_promise_the_same_date(page: Page):
    """Ссылка обещала «полный отчёт по этой же дате», но вела на /report без даты, а тот берёт
    самую свежую сохранённую — то есть открывал другую. Обещание убрано: страница отчёта не умеет
    считать по несохранённой дате, и передавать дату в адрес здесь нельзя."""
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])', timeout=15000)
    page.select_option("#d", "14")
    page.select_option("#m", "5")
    page.select_option("#y", "1988")
    page.click('[data-testid="calc-submit"]')
    page.wait_for_timeout(1200)
    text = page.inner_text("body")
    assert "по этой же дате" not in text, "страница обещает отчёт по этой же дате"


# ── цикл 2: регрессии правок цикла 1 и недозакрытые корни ──────────────────────────────────


def test_error_resets_on_every_calculator_form(page: Page):
    """Правка «ошибка гаснет при изменении поля» была внесена только в форму инфо-страниц: на
    главной живёт другой компонент той же формы, и там сообщение висело. Класс правится поиском
    по признаку «форма расчёта», а не по памяти."""
    for path, prefix, submit in (
        ("/", "", "calc-submit"),
        ("/programmy", "p", "promo-submit"),
    ):
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        page.wait_for_selector(f'[data-testid="{submit}"]:not([disabled])', timeout=15000)
        page.select_option(f"#{prefix}d", "31")
        page.select_option(f"#{prefix}m", "2")
        page.click(f'[data-testid="{submit}"]')
        assert page.locator(".err").count(), f"{path}: сообщение об ошибке не появилось"
        page.select_option(f"#{prefix}m", "3")
        page.wait_for_timeout(300)
        assert not page.locator(".err").count(), f"{path}: сообщение осталось после исправления даты"


def test_placeholder_card_is_called_an_example(page: Page):
    """Чистая главная строила карту по дате-заглушке «сегодня минус 30 лет» и называла её «Ваша
    матрица»: один клик делал невведённую дату целью платежа."""
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])', timeout=15000)
    page.wait_for_timeout(600)
    text = page.inner_text("body")
    assert "Пример карты" in text, "карта-заглушка выдаётся за карту человека"
    assert "Ваша матрица" not in text, "заглушка подписана как «Ваша матрица»"

    page.select_option("#d", "7")
    page.select_option("#m", "3")
    page.select_option("#y", "1990")
    page.click('[data-testid="calc-submit"]')
    page.wait_for_timeout(900)
    after = page.inner_text("body")
    assert "Ваша матрица" in after, "после расчёта карта так и осталась примером"


def test_paid_positions_do_not_promise_a_free_result():
    """Бесплатны только два раздела разбора; на остальных восемнадцати форма обещала показать
    результат «Бесплатно, без регистрации»."""
    for path in ("/encyclopedia/position/money", "/encyclopedia/position/loops",
                 "/encyclopedia/position/soul_tasks", "/encyclopedia/position/chakras"):
        html = _html(path)
        promo = re.search(r'data-testid="calc-promo".*?</div></div>', html, re.S).group(0)
        assert "Бесплатно, без регистрации" not in promo, f"{path}: обещан бесплатный результат"


def test_year_block_on_arcanum_has_a_way_out():
    """Правка, снявшая дубль ссылки, оставила блок «N на год» без ссылки вовсе — текст без выхода."""
    html = _html("/encyclopedia/arcanum/7")
    # React разбивает заголовок комментариями между текстовыми узлами, поэтому ищем по подписи
    block = re.search(r"Тот же аркан в рамке персонального года.*?</div>\s*</div>", html, re.S)
    assert block, "блок «7 на год» не найден"
    assert 'href="/na-god/7"' in block.group(0), "в блоке нет ссылки на страницу года"
    assert html.count('href="/na-god/7"') == 1, "ссылка снова печатается дважды"
