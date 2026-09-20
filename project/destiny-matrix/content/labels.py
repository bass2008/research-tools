"""Подписи метода на языке сборки.

Ключи, селекторы и формулы — контракт (`spec/method.json`, `spec/sections.json`), он один на
все языки. Слова, которые видит человек, живут в `spec/i18n/<lang>.json`: русский там такой же,
как в контракте, и сверяется тестом — иначе перевод молча разъехался бы с движком.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

SPEC_DIR = Path(__file__).resolve().parents[1] / "spec" / "i18n"
DEFAULT_LANG = "ru"


@dataclass(frozen=True)
class Labels:
    lang: str
    sections: dict[str, dict]
    chakras: dict[str, dict]
    chakra_columns: dict[str, str]
    expansions: dict[str, str]

    def section_title(self, key: str) -> str:
        return self.sections[key]["title"]

    def section_lead(self, key: str) -> str:
        return self.sections[key]["lead"]

    def position_label(self, section_key: str, index: int) -> str:
        return self.sections[section_key]["positions"][index]

    def chakra_title(self, key: str) -> str:
        return self.chakras[key]["title"]

    def chakra_hint(self, key: str) -> str:
        return self.chakras[key]["hint"]

    def column_title(self, key: str) -> str:
        return self.chakra_columns[key]


@lru_cache(maxsize=None)
def labels(lang: str = DEFAULT_LANG) -> Labels:
    path = SPEC_DIR / f"{lang}.json"
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise ValueError(f"нет словаря подписей для языка {lang}: {path}") from error
    return Labels(
        lang=lang,
        sections=raw["sections"],
        chakras=raw["chakras"],
        chakra_columns=raw["chakra_columns"],
        expansions=raw["expansions"],
    )


__all__ = ["DEFAULT_LANG", "Labels", "SPEC_DIR", "labels"]
