"""English profile of the shared application (127.0.0.1:3000 in the localized stand).

The domain selects the initial public language; the same frontend and API serve Russian.
"""
from __future__ import annotations

import re
import pytest
import requests
from playwright.sync_api import Page

from conftest import BASE, GATE

CYRILLIC = re.compile(r"[а-яёА-ЯЁ]")

# Страницы, на которых кириллица означает непереведённую строку. Разбор матрицы сюда не входит
# намеренно: его тексты приходят из корпуса, и их проверяет `content.validate`.
PAGES = (
    "/",
    "/method",
    "/author",
    "/contacts",
    "/terms",
    "/privacy",
    "/refund",
    "/encyclopedia",
    "/encyclopedia/arcanum/7",
    "/encyclopedia/position/money",
    "/encyclopedia/chakra/anahata",
    "/encyclopedia/combination/7-18",
    "/encyclopedia/karmic-tail/18-9-9",
    "/year",
    "/year/7",
    "/matrix",
    "/matrix/1-1-2",
    "/login",
    "/account",
)


# Тестовый домен закрыт Basic Auth на уровне nginx; локальный стенд — нет. Реквизиты берёт
# conftest из того же файла, что и остальные прогоны.
AUTH = None if GATE is None else GATE


def _get(path: str):
    return requests.get(f"{BASE}{path}", timeout=30, auth=AUTH)


def _html(path: str) -> str:
    response = _get(path)
    response.raise_for_status()
    return response.text


@pytest.fixture(scope="module", autouse=True)
def only_english():
    if '<html lang="en"' not in _get("/").text:
        pytest.skip("нужен английский профиль: E2E_URL=http://127.0.0.1:3000")


# Подпись переключателя языка читается на языке той версии, куда он ведёт: «Русская версия»
# на английском сайте — это не забытая строка, а указатель.
SWITCH_LABEL = "Русская версия"


@pytest.mark.parametrize("path", PAGES)
def test_page_has_no_russian_left(path):
    html = _html(path).replace(SWITCH_LABEL, " ")
    # <script> с данными страницы исключён: в него попадают ключи корпуса, а не видимый текст
    body = re.sub(r"<script.*?</script>", " ", html, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", body)
    found = sorted(set(CYRILLIC.findall(text)))
    assert not found, f"{path}: на странице осталась кириллица ({''.join(found)[:40]})"


@pytest.mark.parametrize("path", ("/", "/encyclopedia", "/matrix/1-1-2"))
def test_html_lang_and_locale(path):
    html = _html(path)
    assert '<html lang="en"' in html, f"{path}: язык страницы не английский"
    assert 'property="og:locale" content="en_US"' in html or '"og:locale"' not in html


def test_other_language_version_is_linked():
    """hreflang связывает домены, а не языки внутри одного адреса."""
    # Next печатает атрибут как `hrefLang`; в HTML регистр имени атрибута значения не имеет.
    html = _html("/").lower()
    assert 'hreflang="ru"' in html and "arcana-sense.ru" in html
    assert 'hreflang="en"' in html and "arcana-sense.com" in html
    assert 'hreflang="x-default"' in html


def test_payment_pages_follow_the_shared_access_policy():
    """The payment URL explains unavailable providers; shared paid access is preserved."""
    for path in ("/pay", "/pay/single"):
        response = _get(path)
        assert "There are currently no payment methods available for your region" in response.text
        assert 'data-testid="pay-modal"' not in response.text
        status = response.status_code
        assert status == 200, f"{path}: ожидался 200, получен {status}"


def test_reading_keeps_paid_access_after_switching_language(page: Page):
    """Choosing English does not unlock paid content or change account rights."""
    page.goto(f"{BASE}/matrix/1-1-2")
    page.wait_for_selector("h1")
    from playwright.sync_api import expect
    expect(page.locator('a[href^="/pay"]').first).to_be_visible()
    page.get_by_test_id("language-ru").click()
    expect(page.locator("html")).to_have_attribute("lang", "ru")
    expect(page.locator('a[href^="/pay"]').first).to_be_visible()


def test_legal_pages_name_the_owner_without_russian_requisites():
    """Владелец назван именем сервиса: номера ИП спрашивают у продавца, а продаж здесь нет."""
    for path in ("/terms", "/privacy", "/refund"):
        html = _html(path)
        assert "Arcana Sense" in html, f"{path}: владелец не назван"
        assert "⟨" not in html, f"{path}: осталась заглушка реквизитов"
        assert "ИП" not in html and "ОГРНИП" not in html, f"{path}: русские реквизиты на .com"
