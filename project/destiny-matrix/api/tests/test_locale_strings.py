"""Строки, которые сервер показывает человеку, идут на языке контура.

Не всё русское на английском сайте приходит со страниц: подпись сохранённой матрицы и название
плана печатает api, и они доезжают до кабинета и до шапки PDF. Держались эти строки дольше
остального именно потому, что выглядели служебными.
"""
import datetime as dt

import pytest

from app.config import settings
from app.i18n import PHRASES, say
from app.models import default_title


@pytest.fixture()
def english(monkeypatch):
    monkeypatch.setattr(settings, "site_lang", "en")


def test_default_title_follows_site_lang(english):
    # Заголовок виден в кабинете и становится именем скачиваемого PDF.
    assert default_title(dt.date(1993, 3, 31)) == "Chart of 31 March 1993"


def test_default_title_stays_russian_by_default():
    assert default_title(dt.date(1993, 3, 31)) == "Матрица 31 марта 1993"


def test_month_names_cover_the_year():
    for lang in ("ru", "en"):
        months = PHRASES["matrix.months"][lang].split()
        assert len(months) == 12, lang
        assert len(set(months)) == 12, lang


def test_plan_and_error_translated(english):
    assert say("report.plan_full") == "Full reading"
    assert say("report.plan_free") == "Free preview"
    assert say("error.internal") == "Internal error"


def test_every_phrase_has_both_languages():
    missing = [key for key, phrase in PHRASES.items() if not phrase.get("ru") or not phrase.get("en")]
    assert missing == []


def test_no_cyrillic_left_in_english_phrases():
    bad = [key for key, phrase in PHRASES.items()
           if any("Ѐ" <= ch <= "ӿ" for ch in phrase["en"])]
    assert bad == []
