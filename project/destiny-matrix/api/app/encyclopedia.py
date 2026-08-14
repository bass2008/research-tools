from __future__ import annotations

import json
from itertools import combinations
from pathlib import Path

from .arcana import ARCANA, BY_N, CHAKRA_KEYS, POSITION_TITLES, ROMAN
from .config import settings
from .report import SECTION_TITLES

ARCANA_MAX = 22
COMBINATIONS_COUNT = len(list(combinations(range(1, ARCANA_MAX + 1), 2)))  # 231

_cache: dict[str, tuple[float, object]] = {}


def _read_json(path: Path):
    """Кеш по mtime: генератор контента перезаписывает файлы на ходу."""
    try:
        stat = path.stat()
    except OSError:
        return None
    hit = _cache.get(str(path))
    if hit is not None and hit[0] == stat.st_mtime:
        return hit[1]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    _cache[str(path)] = (stat.st_mtime, data)
    return data


def _content_dir() -> Path:
    return Path(settings.encyclopedia_dir)


def _from_files(n: int) -> dict | None:
    root = _content_dir()
    for candidate in (root / "arcanum" / f"{n}.json", root / "arcana" / f"{n}.json"):
        data = _read_json(candidate)
        if isinstance(data, dict):
            return data
    bundle = _read_json(root / "arcana.json")
    if isinstance(bundle, dict):
        entry = bundle.get(str(n)) or bundle.get(n)
        if isinstance(entry, dict):
            return entry
        # генератор кладёт записи в items; ключ arcana оставлен как совместимость
        items = bundle.get("items") or bundle.get("arcana")
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict) and item.get("n") == n:
                    return item
    elif isinstance(bundle, list):
        for item in bundle:
            if isinstance(item, dict) and item.get("n") == n:
                return item
    return None


def _stub(n: int) -> dict:
    """Заглушка, пока генератор энциклопедии не положил файлы: форма по контракту."""
    _num, slug, title = BY_N[n]
    others = [k for k in range(1, ARCANA_MAX + 1) if k != n]
    return {
        "n": n,
        "slug": slug,
        "title": title,
        "roman": ROMAN[n],
        "matrix_number": n,
        "short": f"{n} аркан — {title.lower()}: текст готовится.",
        "keywords": [title.lower(), f"{n} аркан", f"{n} аркан матрицы судьбы"],
        "meaning": "",
        "in_positions": {},
        "plus": [],
        "minus": [],
        "combinations": [
            {"with": k,
             "href": f"/encyclopedia/combination/{min(n, k)}-{max(n, k)}",
             "short": ""}
            for k in others
        ],
        "seo": {
            "title": f"{n} аркан — {title} в матрице судьбы",
            "description": f"{title}: значение {n} аркана в матрице судьбы, в позициях и сочетаниях.",
            "queries": [f"{n} аркан", f"{n} аркан матрицы судьбы", title.lower()],
        },
        "stub": True,
    }


def arcanum(n: int) -> dict | None:
    if n not in BY_N:
        return None
    found = _from_files(n)
    if found is None:
        return _stub(n)
    data = dict(found)
    data.setdefault("n", n)
    data.setdefault("matrix_number", n)
    data.setdefault("roman", ROMAN[n])
    data.setdefault("slug", BY_N[n][1])
    data.setdefault("title", BY_N[n][2])
    return data


def index() -> dict:
    prepared = _read_json(_content_dir() / "index.json")
    if isinstance(prepared, dict) and "arcana" in prepared:
        out = dict(prepared)
        out.setdefault("combinations_count", COMBINATIONS_COUNT)
        return out
    arcana = [
        {"n": n, "slug": slug, "title": title, "roman": ROMAN[n],
         "href": f"/encyclopedia/arcanum/{n}"}
        for n, slug, title in ARCANA
    ]
    positions = [
        {"key": key, "title": title, "kind": "section",
         "href": f"/encyclopedia/position/{key}"}
        for key, title in SECTION_TITLES.items()
    ] + [
        {"key": key, "title": title, "kind": "matrix",
         "href": f"/encyclopedia/position/{key}"}
        for key, title in POSITION_TITLES.items()
    ]
    return {
        "arcana": arcana,
        "positions": positions,
        "combinations_count": COMBINATIONS_COUNT,
        "chakras": [{"key": key, "href": f"/encyclopedia/chakra/{key}"} for key in CHAKRA_KEYS],
        "pages": len(arcana) + len(positions) + COMBINATIONS_COUNT + len(CHAKRA_KEYS) + 1,
        "source": "files" if _from_files(1) else "stub",
    }
