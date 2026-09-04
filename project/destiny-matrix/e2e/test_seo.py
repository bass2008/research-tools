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


# Норма обхода молодого сайта тратится на скачивание того, что робот уже видел. Экономят её два
# условных заголовка — `ETag` и `Last-Modified`, — и оба живут в отданном ответе, а не в
# исходниках: `middleware.test.ts` сторожит логику, но не то, что заголовок дошёл до клиента.
CONDITIONAL_PAGES = (
    "/encyclopedia",
    "/encyclopedia/arcanum/7",
    "/encyclopedia/chakra/anahata",
    "/encyclopedia/combination/7-18",
    "/encyclopedia/position/comfort",
    "/encyclopedia/karmic-tail/18-9-9",
    "/na-god/13",
    "/matrix",
)

def _corpus_date() -> str:
    """Дата корпуса — из отданного заголовка, а не из константы в тесте: зашитая дата ломала бы
    набор на каждой правке корпуса, а до того молча проверяла бы неверное число."""
    stamp = requests.get(f"{BASE}/encyclopedia", timeout=30).headers.get("Last-Modified")
    assert stamp, "корпус отдаётся без Last-Modified — обход платит за то, что уже видел"
    return stamp


@pytest.mark.parametrize("path", CONDITIONAL_PAGES)
def test_corpus_answers_conditional_request_by_date(path):
    """Яндекс сверяет дату. Next ставит только `ETag`, поэтому без `Last-Modified` корпус
    качался целиком на каждом проходе."""
    full = requests.get(f"{BASE}{path}", timeout=30)
    assert full.status_code == 200, (path, full.status_code)
    stamp = full.headers.get("Last-Modified")
    assert stamp, f"{path}: нет Last-Modified — обход платит за то, что уже видел"

    same = requests.get(f"{BASE}{path}", timeout=30, headers={"If-Modified-Since": stamp})
    assert same.status_code == 304, (path, same.status_code)
    assert not same.content, f"{path}: 304 пришёл с телом {len(same.content)} байт"

    older = requests.get(
        f"{BASE}{path}", timeout=30, headers={"If-Modified-Since": "Mon, 25 Aug 2026 00:00:00 GMT"}
    )
    assert older.status_code == 200, (path, older.status_code)


@pytest.mark.parametrize("path", CONDITIONAL_PAGES)
def test_fingerprint_outranks_the_date(path):
    """RFC 9110 §13.2.2: при обоих заголовках побеждает `If-None-Match`. Отпечаток знает о правке
    текста, а дата корпуса — нет, поэтому ответ по дате спрятал бы правку от Googlebot, который
    присылает оба."""
    full = requests.get(f"{BASE}{path}", timeout=30)
    tag = full.headers.get("ETag")
    if not tag:
        pytest.skip(f"{path} отдаётся динамически, отпечатка нет")

    both = requests.get(
        f"{BASE}{path}", timeout=30, headers={"If-None-Match": tag, "If-Modified-Since": _corpus_date()}
    )
    assert both.status_code == 304, (path, both.status_code)

    stale = requests.get(
        f"{BASE}{path}",
        timeout=30,
        headers={"If-None-Match": '"stale"', "If-Modified-Since": _corpus_date()},
    )
    assert stale.status_code == 200, f"{path}: чужой отпечаток получил 304 — правка спрятана"


def test_calculation_results_share_no_corpus_date():
    """Разбор зависит от `?birth=`, поэтому общий `304` по дате корпуса отдал бы из кэша браузера
    чужую карту. Эти адреса закрыты и от обхода, и от условного ответа."""
    for path in ("/matrix/1-1-10", "/encyclopedia/comfort/4-6-13", "/encyclopedia/character/4-9-7"):
        r = requests.get(f"{BASE}{path}", timeout=30)
        assert r.headers.get("Last-Modified") is None, f"{path}: получил общую дату корпуса"
        conditional = requests.get(
            f"{BASE}{path}", timeout=30, headers={"If-Modified-Since": _corpus_date()}
        )
        assert conditional.status_code == 200, (path, conditional.status_code)


# Раздел справочника существовал только как фильтр `?sec=`: тот адрес несёт canonical на
# /encyclopedia, поэтому крошка на каждом листе объявляла родителем страницу, которой в поиске
# нет, а сама /encyclopedia раздавала 363 ссылки — две трети из них на 231 пару арканов.
SECTION_HUBS = (
    ("/encyclopedia/arcanum", "22 аркана"),
    ("/encyclopedia/position", "Позиции карты"),
    ("/encyclopedia/chakra", "Семь чакр"),
    ("/encyclopedia/combination", "Сочетания арканов"),
    ("/encyclopedia/karmic-tail", "Кармические хвосты"),
    ("/na-god", "Матрица судьбы на год"),
)

# Лист → шапка, которую он обязан объявить родителем.
LEAF_PARENTS = (
    ("/encyclopedia/arcanum/7", "/encyclopedia/arcanum"),
    ("/encyclopedia/chakra/anahata", "/encyclopedia/chakra"),
    ("/encyclopedia/combination/7-18", "/encyclopedia/combination"),
    ("/encyclopedia/position/center", "/encyclopedia/position"),
    ("/encyclopedia/position/character", "/encyclopedia/position"),
    ("/encyclopedia/karmic-tail/18-9-9", "/encyclopedia/karmic-tail"),
    ("/na-god/13", "/na-god"),
)


@pytest.mark.parametrize("path,crumb", SECTION_HUBS)
def test_section_hub_is_a_page_with_its_own_text(path, crumb):
    """Шапка обязана отвечать на головной запрос раздела своими словами. Список ссылок без
    текста — тот же плоский каталог на уровень ниже, и в выдаче он читается как дорвей."""
    html = _html(path)
    assert "BreadcrumbList" in _types(html), path
    canonical = re.search(r'<link rel="canonical" href="([^"]+)"', html)
    assert canonical and canonical.group(1).endswith(path), (path, canonical and canonical.group(1))
    headings = _headings(html)
    assert headings and headings[0][0] == 1, (path, headings[:2])
    assert sum(1 for rank, _ in headings if rank == 2) >= 4, (path, headings)
    prose = re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", " ", re.sub(r"(?is)<script.*?</script>", "", html)))
    assert len(prose) > 5000, f"{path}: текста {len(prose)} знаков — шапка без разбора понятия"


@pytest.mark.parametrize("leaf,hub", LEAF_PARENTS)
def test_leaf_declares_an_existing_parent(leaf, hub):
    """Третий уровень крошки — адрес, который открывается, а не фильтр с параметром."""
    schemas = [s for s in _schemas(_html(leaf)) if s.get("@type") == "BreadcrumbList"]
    assert schemas, leaf
    trail = schemas[0]["mainEntity" if "mainEntity" in schemas[0] else "itemListElement"]
    parent = trail[2]
    assert parent.get("item", "").endswith(hub), (leaf, parent)
    assert "?sec=" not in parent.get("item", ""), (leaf, parent)
    assert requests.get(f"{BASE}{hub}", timeout=30).status_code == 200, hub


def test_encyclopedia_is_a_table_of_contents_not_a_flat_list():
    """Раздача 363 ссылок с одной страницы делила вес между 231 парой арканов и 7 чакрами
    поровну, а поиск читал справочник как один каталог однотипного."""
    html = _html("/encyclopedia")
    body = re.sub(r"(?is)<script.*?</script>", "", html)
    hrefs = {m.group(1).split("#")[0].rstrip("/") or "/" for m in re.finditer(r'<a\b[^>]*href="(/[^"?]*)"', body)}
    assert len(hrefs) < 40, f"страница снова раздаёт {len(hrefs)} ссылок"
    leaves = [h for h in hrefs if re.match(r"^/(encyclopedia/[a-z_-]+/.+|na-god/.+)$", h)]
    assert leaves == [], f"на оглавлении снова листья: {leaves[:5]}"
    for hub, _ in SECTION_HUBS:
        assert hub in hrefs, f"оглавление не ведёт к шапке {hub}"


def test_section_address_comes_only_from_the_registry():
    """Единственный законный `?sec=` — у «Статей»: ветки справочника у них нет. Остальные
    зашитые адреса раздела после переезда продолжали вести на фильтр."""
    for path in ("/", "/encyclopedia", "/encyclopedia/arcanum/7", "/encyclopedia/position/center", "/o-metode"):
        body = re.sub(r"(?is)<script.*?</script>", "", _html(path))
        found = set(re.findall(r'href="(/encyclopedia\?sec=[a-z]+)"', body))
        assert not {x for x in found if not x.endswith("sec=art")}, (path, found)


# Пересечения «аркан N в позиции X»: 80 адресов из реестра спроса. Спрашивают именно их —
# «8 аркан профессии», «9 в хвосте матрицы судьбы», — а каталог из 22 карточек формально содержит
# ответ, но ответом не является: медиана позиции у каталогов 33–42, у раздела, где адрес
# повторяет запрос, — 5.
def _registry() -> list[dict]:
    path = pathlib.Path(__file__).resolve().parents[1] / "web" / "content" / "position-arcanum.json"
    return json.loads(path.read_text(encoding="utf-8"))["items"]


CROSSINGS = _registry()
CROSSING_SAMPLE = [
    (item["position"], item["arcanum"])
    for item in (CROSSINGS[0], CROSSINGS[len(CROSSINGS) // 2], CROSSINGS[-1])
]


def test_every_crossing_of_the_registry_is_a_page():
    """Реестр и сайт обязаны совпадать: запись без страницы — потерянный спрос, страница без
    записи — тонкий корпус, которым проект уже обжигался на 76 хвостах и 5 544 матрицах."""
    missing = []
    for item in CROSSINGS:
        url = f"/encyclopedia/position/{item['position']}/{item['arcanum']}"
        if requests.get(f"{BASE}{url}", timeout=30).status_code != 200:
            missing.append(url)
    assert missing == [], missing


def test_crossing_outside_the_registry_is_not_invented():
    """Адрес появляется только против записи реестра, а не под любую пару чисел."""
    for url in (
        "/encyclopedia/position/center/99",
        "/encyclopedia/position/nonsense/6",
        "/encyclopedia/position/center/6/extra",
    ):
        assert requests.get(f"{BASE}{url}", timeout=30).status_code == 404, url


@pytest.mark.parametrize("position,arcanum", CROSSING_SAMPLE)
def test_crossing_page_answers_one_question(position, arcanum):
    """Страница-ответ, а не карточка в каталоге: свой h1, свои крошки до позиции, свой разбор."""
    url = f"/encyclopedia/position/{position}/{arcanum}"
    html = _html(url)
    headings = _headings(html)
    assert headings and headings[0][0] == 1, (url, headings[:2])
    assert str(arcanum) in headings[0][1], (url, headings[0][1])
    assert sum(1 for rank, _ in headings if rank == 2) >= 3, (url, headings)
    canonical = re.search(r'<link rel="canonical" href="([^"]+)"', html)
    assert canonical and canonical.group(1).endswith(url), (url, canonical)
    prose = re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", " ", re.sub(r"(?is)<script.*?</script>", "", html)))
    assert len(prose) > 4000, f"{url}: текста {len(prose)} знаков"

    schemas = [s for s in _schemas(html) if s.get("@type") == "BreadcrumbList"]
    assert schemas, url
    trail = [item.get("item", "") for item in schemas[0]["itemListElement"]]
    assert any(t.endswith(f"/encyclopedia/position/{position}") for t in trail), (url, trail)


def test_crossings_are_reachable_without_the_sitemap():
    """Восемьдесят адресов не должны быть сиротами: в карте есть, а входящих ссылок нет — так
    поиск узнаёт о странице, но не видит её места в справочнике."""
    linked: set[str] = set()
    for source in {f"/encyclopedia/position/{item['position']}" for item in CROSSINGS} | {
        f"/encyclopedia/arcanum/{item['arcanum']}" for item in CROSSINGS
    }:
        body = re.sub(r"(?is)<script.*?</script>", "", _html(source))
        linked |= set(re.findall(r'href="(/encyclopedia/position/[a-z_]+/\d+)"', body))
    wanted = {f"/encyclopedia/position/{i['position']}/{i['arcanum']}" for i in CROSSINGS}
    assert wanted - linked == set(), sorted(wanted - linked)[:5]
