"""Strict loaders for the machine-readable calculation and report contracts."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


SPEC_DIR = Path(__file__).resolve().parents[1] / "spec"


def _without_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_spec(name: str) -> dict[str, Any]:
    path = SPEC_DIR / name
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_without_duplicate_keys,
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise ValueError(f"cannot load specification {path}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError(f"{path}: expected a JSON object")
    return value


METHOD = load_spec("method.json")
REPORT_SECTIONS = load_spec(str(METHOD["report_sections"]))


__all__ = ["METHOD", "REPORT_SECTIONS", "SPEC_DIR", "load_spec"]
