"""Compile the canonical text-safety policy for Python content checks."""
from __future__ import annotations

import re
from dataclasses import dataclass

from .source import TEXT_POLICY


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


if not isinstance(TEXT_POLICY, dict):
    raise ValueError("text-policy.json: expected an object")

STYLE_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in _strings(TEXT_POLICY.get("style_patterns"), "style_patterns")
)

_BLOCKED: list[tuple[frozenset[str], str, str, re.Pattern[str]]] = []
raw_groups = TEXT_POLICY.get("blocked")
if not isinstance(raw_groups, list) or not raw_groups:
    raise ValueError("text-policy.json: blocked must be a non-empty array")
for index, raw_group in enumerate(raw_groups):
    if not isinstance(raw_group, dict) or not isinstance(raw_group.get("id"), str):
        raise ValueError(f"text-policy.json: blocked[{index}] must have an id")
    category = raw_group["id"]
    scopes = frozenset(_strings(raw_group.get("scopes"), f"blocked[{index}].scopes"))
    if not scopes <= {"content", "html"}:
        raise ValueError(f"text-policy.json: blocked[{index}] has an unknown scope")
    prefixes = _strings(raw_group.get("prefixes"), f"blocked[{index}].prefixes", allow_empty=True)
    phrases = _strings(raw_group.get("phrases"), f"blocked[{index}].phrases", allow_empty=True)
    if not prefixes and not phrases:
        raise ValueError(f"text-policy.json: blocked[{index}] has no rules")
    for prefix in prefixes:
        pattern = re.compile(
            rf"(?<![{_WORD}]){re.escape(prefix)}[{_LETTERS}]*",
            re.IGNORECASE,
        )
        _BLOCKED.append((scopes, category, prefix, pattern))
    for phrase in phrases:
        _BLOCKED.append((scopes, category, phrase, re.compile(re.escape(phrase), re.IGNORECASE)))

POLICY_CASES = TEXT_POLICY.get("cases")
if not isinstance(POLICY_CASES, list) or not all(
    isinstance(case, dict)
    and isinstance(case.get("text"), str)
    and isinstance(case.get("content_blocked"), bool)
    and isinstance(case.get("html_blocked"), bool)
    for case in POLICY_CASES
):
    raise ValueError("text-policy.json: cases must contain text and both scope results")


def blocked_match(text: str, scope: str = "content") -> BlockedMatch | None:
    """Return the first matched safety rule, or ``None`` for allowed text."""
    if scope not in {"content", "html"}:
        raise ValueError(f"unknown text-policy scope: {scope}")
    for scopes, category, rule, pattern in _BLOCKED:
        if scope not in scopes:
            continue
        found = pattern.search(text)
        if found:
            return BlockedMatch(category, rule, found.group())
    return None


def is_blocked(text: str, scope: str = "content") -> bool:
    return blocked_match(text, scope) is not None


__all__ = ["BlockedMatch", "POLICY_CASES", "STYLE_PATTERNS", "blocked_match", "is_blocked"]
