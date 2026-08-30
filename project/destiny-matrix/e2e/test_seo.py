"""Техническое SEO: разметка, канонизация адресов и вход в расчёт на инфо-страницах.

Проверяется отданный HTML, а не исходники: разметку легко потерять при правке шаблона, и
заметно это только в выдаче — через недели.
"""
from __future__ import annotations

import json
import pathlib
import re

import pytest
import requests

from conftest import BASE

pytestmark = pytest.mark.seo

# Юридические и хабовые страницы тоже индексируются и лежат в карте сайта: первый прогон
# проверял только энциклопедию, и поэтому не заметил, что BreadcrumbList на них не появился.
CRUMB_PAGES = (
    "/encyclopedia",
    "/matrix",
    "/contacts",
    "/oferta",
    "/privacy",
    "/refund",
)

INFO_PAGES = (
    "/encyclopedia/arcanum/7",
    "/encyclopedia/position/center",
    "/encyclopedia/chakra/anahata",
    "/encyclopedia/combination/7-18",
    "/encyclopedia/karmic-tail",
    "/encyclopedia/karmic-tail/18-9-9",
    "/na-god",
)


def _html(path: str) -> str:
    r = requests.get(f"{BASE}{path}", timeout=30)
    assert r.status_code == 200, f"{path} → {r.status_code}"
    return r.text


def _headings(html: str) -> list[tuple[int, str]]:
    headings = []
    for rank, content in re.findall(r"<h([1-6])(?:\s[^>]*)?>(.*?)</h\1>", html, re.S):
        text = re.sub(r"<[^>]+>|<!--.*?-->", "", content, flags=re.S)
        headings.append((int(rank), " ".join(text.split())))
    return headings


def _schemas(html: str) -> list[dict]:
    out = []
    for raw in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        out.append(json.loads(raw))
    return out


def _types(html: str) -> set[str]:
    return {s.get("@type") for s in _schemas(html)}


def _hubs() -> list[dict]:
    path = pathlib.Path(__file__).resolve().parents[1] / "web/content/hubs.json"
    return json.loads(path.read_text())["items"]


def test_matrix_catalog_uses_top_level_h2_sections():
    """Самостоятельные блоки каталога не должны выглядеть подразделами друг друга."""
    assert _headings(_html("/matrix")) == [
        (1, "Все матрицы судьбы"),
        (2, "Как устроен адрес"),
        (2, "Вход по аркану дня"),
        (2, "Куда дальше"),
        (2, "Найти свою матрицу"),
    ]


@pytest.mark.parametrize(
    "path,title",
    (("/reset", "Ссылка неполная"), ("/reset?token=heading-regression", "Новый пароль")),
)
def test_reset_has_one_page_heading(path, title):
    """Обе ветки смены пароля имеют собственный h1, даже хотя страница закрыта noindex."""
    assert _headings(_html(path)) == [(1, title)]


@pytest.mark.parametrize("path", INFO_PAGES)
def test_breadcrumbs_are_marked_up(path):
    """Крошки видны на странице, но BreadcrumbList к ним раньше не прилагался."""
    html = _html(path)
    assert "BreadcrumbList" in _types(html), f"{path}: нет BreadcrumbList"
    crumbs = next(s for s in _schemas(html) if s.get("@type") == "BreadcrumbList")
    positions = [i["position"] for i in crumbs["itemListElement"]]
    assert positions == list(range(1, len(positions) + 1)), positions
    # последняя крошка — текущая страница, у неё item не нужен
    assert "item" not in crumbs["itemListElement"][-1]


@pytest.mark.parametrize("path", CRUMB_PAGES)
def test_breadcrumbs_are_marked_up_outside_the_encyclopedia(path):
    """Требование плана — «во все шаблоны». Юридические страницы рисовали крошки руками и
    оставались без разметки, хотя лежат в карте сайта и индексируются."""
    html = _html(path)
    assert 'class="crumbs' in html, f"{path}: пропали видимые крошки"
    assert "BreadcrumbList" in _types(html), f"{path}: нет BreadcrumbList"


def test_arcanum_links_back_to_its_karmic_tails():
    """Аркан — самая посещаемая страница справочника: без обратной ссылки разобранные тройки
    висели бы только на своём хабе."""
    html = _html("/encyclopedia/arcanum/9")
    assert "/encyclopedia/karmic-tail/18-9-9" in html, "с аркана 9 нет ссылки на хвост 18-9-9"


@pytest.mark.parametrize(
    "page_path,expected",
    (
        # автор ставит связь односторонне и указателем; обратную сторону строит рендер
        ("/na-god/7", "/encyclopedia/arcanum/7"),
        ("/encyclopedia/arcanum/7", "/na-god/7"),
        ("/programmy", "/encyclopedia/position/loops"),
        ("/encyclopedia/position/loops", "/programmy"),
    ),
)
def test_related_works_both_ways(page_path, expected):
    """B7: перелинковка в обе стороны. Взаимность держит код — иначе каждая новая статья
    требовала бы правки уже сданных."""
    assert f'href="{expected}"' in _html(page_path), f"{page_path}: нет ссылки на {expected}"


def test_related_never_points_at_a_missing_page():
    """Указатель на ненаписанную страницу отбрасывается: ссылка в никуда хуже её отсутствия.
    Проверяем по тройкам, которых нет в корпусе, — те, на которые ссылается 18-9-9, уже написаны."""
    written = {
        item["key"]
        for item in json.loads(
            (pathlib.Path(__file__).resolve().parents[1] / "web/content/karmic-tails.json").read_text()
        )["items"]
    }
    html = _html("/encyclopedia/karmic-tail/18-9-9")
    for triple in ("1-2-3", "2-3-5", "1-1-2"):
        assert triple not in written, f"{triple} появилась в корпусе — тест нужно обновить"
        assert f'href="/encyclopedia/karmic-tail/{triple}"' not in html, triple


def test_concept_hub_gets_an_incoming_link_when_written():
    """Хаб без статьи в карту не попадает; как только статья появится, на него обязана вести
    внутренняя ссылка — иначе страница-сирота в индексе."""
    hubs = _hubs()
    if not hubs:
        pytest.skip("статей-хабов ещё нет")
    html = _html("/encyclopedia")
    for item in hubs:
        assert f'href="/{item["key"]}"' in html, f"на хаб /{item['key']} не ведёт ни одна ссылка"


@pytest.mark.parametrize("path", INFO_PAGES)
def test_article_carries_the_fields_google_requires(path):
    """Article без author/datePublished/publisher поиск отбраковывает целиком."""
    html = _html(path)
    article = next((s for s in _schemas(html) if s.get("@type") == "Article"), None)
    assert article is not None, f"{path}: нет Article"
    for field in ("author", "publisher", "datePublished", "dateModified", "headline"):
        assert article.get(field), f"{path}: в Article нет {field}"


@pytest.mark.parametrize("path", INFO_PAGES)
def test_info_page_offers_the_calculator(path):
    """Инфо-трафик уходил без действия: форма расчёта стояла только на странице аркана.
    В справочнике форма переехала в общий первый экран каркаса, поэтому годится любая из двух."""
    html = _html(path)
    assert 'data-testid="calc-promo"' in html or 'data-testid="calc-submit"' in html, (
        f"{path}: нет входа в расчёт"
    )


def test_arcanum_title_and_h1_match_the_query():
    """505k показов идут на форму «N в матрице судьбы», а H1 был просто именем аркана."""
    html = _html("/encyclopedia/arcanum/7")
    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
    assert title.startswith("7 в матрице судьбы"), title
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S).group(1)
    assert "7" in h1 and "в матрице судьбы" in re.sub(r"<[^>]+>|<!--.*?-->", "", h1)


def test_matrix_pages_leave_the_index_but_keep_their_links():
    """5544 почти-дубля тянули домен вниз. Страница остаётся, но не индексируется; nofollow
    здесь обрывал бы перелинковку каталога на арканы и позиции."""
    html = _html("/matrix/1-1-10")
    robots = re.search(r'<meta name="robots" content="([^"]+)"', html).group(1)
    assert "noindex" in robots and "nofollow" not in robots, robots


def test_matrices_are_out_of_the_sitemap():
    """Состав карты проверяет app/sitemap.test.ts: вне боевого контура она пустая намеренно,
    чтобы тест не сдавал поиску свои адреса. Здесь — только что матрицы в неё не вернулись."""
    xml = requests.get(f"{BASE}/sitemap.xml", timeout=30).text
    assert "/matrix/1-1-" not in xml, "страницы матриц вернулись в карту сайта"


def test_one_tail_is_one_address():
    """Два порядка одной формы имеют собственные self-canonical, если оба достижимы."""
    for triple in ("9-9-18", "18-9-9"):
        r = requests.get(
            f"{BASE}/encyclopedia/karmic-tail/{triple}", timeout=30, allow_redirects=False
        )
        assert r.status_code == 200, (triple, r.status_code)
        canonical = re.search(r'<link rel="canonical" href="([^"]+)"', r.text)
        assert canonical and canonical.group(1).endswith(f"/{triple}"), (triple, canonical)


def test_unknown_tail_is_a_real_404_not_a_soft_redirect():
    r = requests.get(f"{BASE}/encyclopedia/karmic-tail/1-2-3", timeout=30,
                     allow_redirects=False)
    assert r.status_code == 404
    assert "location" not in r.headers


def test_product_tail_without_demand_is_noindex_and_absent_from_sitemap():
    path = "/encyclopedia/karmic-tail/9-18-9"
    html = _html(path)
    robots = re.search(r'<meta name="robots" content="([^"]+)"', html).group(1)
    assert "noindex" in robots and "nofollow" not in robots, robots
    sitemap = requests.get(f"{BASE}/sitemap.xml", timeout=30).text
    assert path not in sitemap


def test_tail_page_does_not_promise_a_triple_the_engine_cannot_give():
    """Достижимая статья показывает продуктовую формулу M–N–D, а не старую формулу года."""
    html = _html("/encyclopedia/karmic-tail/18-9-9")
    assert "порядок фиксирован: M–N–D" in html
    assert "Хвост складывается из аркана года" not in html


def test_faq_markup_appears_only_with_visible_questions():
    with_faq = _html("/encyclopedia/karmic-tail/18-9-9")
    assert "FAQPage" in _types(with_faq)
    questions = [s for s in _schemas(with_faq) if s.get("@type") == "FAQPage"][0]["mainEntity"]
    for item in questions:
        assert item["name"] in with_faq, f"вопрос {item['name']!r} есть в разметке, но не на странице"


@pytest.mark.parametrize(
    "path,target",
    (
        ("/programmy", "/encyclopedia/position/loops"),
        ("/energii", "/encyclopedia/position/chakras"),
        ("/karmicheskaya-matrica", "/encyclopedia/karmic-tail"),
    ),
)
def test_hub_serves_a_page_or_leads_somewhere_useful(path, target):
    """Роут появляется раньше статьи. Со статьёй адрес отдаёт страницу; без неё — не пустую
    посадочную и не 404, а временный редирект на ближайшую страницу того же смысла (постоянный
    склеил бы адреса, и появление статьи потребовало бы расклейки)."""
    written = {item["key"] for item in _hubs()}
    r = requests.get(f"{BASE}{path}", timeout=30, allow_redirects=False)
    if path.lstrip("/") in written:
        assert r.status_code == 200, f"{path}: статья есть, но страница отдаёт {r.status_code}"
        assert 'class="crumbs' in r.text and "BreadcrumbList" in r.text
    else:
        assert r.status_code in (302, 307), f"{path}: {r.status_code}, ожидался временный редирект"
        assert r.headers["location"].endswith(target), r.headers["location"]
