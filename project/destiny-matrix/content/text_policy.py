"""Compile the canonical text-safety policy for Python content checks.

Политика языкозависима: запреты ловят подстроку, а не смысл, и русский список к английскому
тексту неприменим. Каждый язык держит свой `content/data/<lang>/text-policy.json`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache

from .source import DEFAULT_LANG, corpus


_WORD = "а-яёa-z0-9"
_LETTERS = "а-яёa-z"


@dataclass(frozen=True)
class BlockedMatch:
    category: str
    rule: str
    matched: str


def _strings(value: object, where: str, *, allow_empty: bool = False) -> tuple[str, ...]:
    if (
        not isinstance(value, list)
        or (not value and not allow_empty)
        or not all(isinstance(item, str) and item for item in value)
    ):
        qualifier = "a string array" if allow_empty else "a non-empty string array"
        raise ValueError(f"text-policy.json: {where} must be {qualifier}")
    return tuple(value)


@lru_cache(maxsize=None)
def style_patterns(lang: str = DEFAULT_LANG) -> tuple[re.Pattern[str], ...]:
    policy = _policy(lang)
    return tuple(
        re.compile(pattern, re.IGNORECASE)
        for pattern in _strings(policy.get("style_patterns"), "style_patterns")
    )


@lru_cache(maxsize=None)
def _policy(lang: str) -> dict:
    policy = corpus(lang).text_policy
    if not isinstance(policy, dict):
        raise ValueError("text-policy.json: expected an object")
    return policy


@lru_cache(maxsize=None)
def _rules(lang: str) -> tuple[tuple[frozenset[str], str, str, re.Pattern[str]], ...]:
    out: list[tuple[frozenset[str], str, str, re.Pattern[str]]] = []
    raw_groups = _policy(lang).get("blocked")
    if not isinstance(raw_groups, list) or not raw_groups:
        raise ValueError("text-policy.json: blocked must be a non-empty array")
    for index, raw_group in enumerate(raw_groups):
        if not isinstance(raw_group, dict) or not isinstance(raw_group.get("id"), str):
            raise ValueError(f"text-policy.json: blocked[{index}] must have an id")
        category = raw_group["id"]
        scopes = frozenset(_strings(raw_group.get("scopes"), f"blocked[{index}].scopes"))
        if not scopes <= {"content", "html"}:
            raise ValueError(f"text-policy.json: blocked[{index}] has an unknown scope")
        prefixes = _strings(raw_group.get("prefixes"), f"blocked[{index}].prefixes",
                            allow_empty=True)
        phrases = _strings(raw_group.get("phrases"), f"blocked[{index}].phrases", allow_empty=True)
        if not prefixes and not phrases:
            raise ValueError(f"text-policy.json: blocked[{index}] has no rules")
        for prefix in prefixes:
            pattern = re.compile(
                rf"(?<![{_WORD}]){re.escape(prefix)}[{_LETTERS}]*",
                re.IGNORECASE,
            )
            out.append((scopes, category, prefix, pattern))
        for phrase in phrases:
            out.append((scopes, category, phrase,
                        re.compile(re.escape(phrase), re.IGNORECASE)))
    return tuple(out)


@lru_cache(maxsize=None)
def policy_cases(lang: str = DEFAULT_LANG) -> list[dict]:
    cases = _policy(lang).get("cases")
    if not isinstance(cases, list) or not all(
        isinstance(case, dict)
        and isinstance(case.get("text"), str)
        and isinstance(case.get("content_blocked"), bool)
        and isinstance(case.get("html_blocked"), bool)
        for case in cases
    ):
        raise ValueError("text-policy.json: cases must contain text and both scope results")
    return cases


def blocked_match(text: str, scope: str = "content",
                  lang: str = DEFAULT_LANG) -> BlockedMatch | None:
    """Return the first matched safety rule, or ``None`` for allowed text."""
    if scope not in {"content", "html"}:
        raise ValueError(f"unknown text-policy scope: {scope}")
    for scopes, category, rule, pattern in _rules(lang):
        if scope not in scopes:
            continue
        found = pattern.search(text)
        if found:
            return BlockedMatch(category, rule, found.group())
    return None


def is_blocked(text: str, scope: str = "content", lang: str = DEFAULT_LANG) -> bool:
    return blocked_match(text, scope, lang) is not None


# Русский — язык по умолчанию: проверки, которые язык не выбирают, работают с ним.
STYLE_PATTERNS = style_patterns(DEFAULT_LANG)
POLICY_CASES = policy_cases(DEFAULT_LANG)


__all__ = [
    "BlockedMatch",
    "POLICY_CASES",
    "STYLE_PATTERNS",
    "blocked_match",
    "is_blocked",
    "policy_cases",
    "style_patterns",
]
