"""Конфиг: адрес FastAPI (`APP_URL`) и секрет внутренних эндпоинтов (`INTERNAL_TOKEN`).

Пакет поднимают через `conda run` из произвольного каталога, поэтому рабочий каталог ничего не
значит: `.env` ищем от корня пакета вверх (обычно это корень проекта, рядом с `wscore.py`).
Переменные окружения приоритетнее файла — как в `wscore.load_env` (`setdefault`).
"""

from __future__ import annotations

import os
from pathlib import Path

PKG_ROOT = Path(__file__).resolve().parents[2]      # .../task-worker-mcp
DEFAULT_APP_URL = "http://127.0.0.1:8000"

_env_file: Path | None = None
_loaded = False


def find_env(start: Path = PKG_ROOT) -> Path | None:
    """Первый `.env` от каталога `start` и вверх до корня ФС."""
    for d in (start, *start.parents):
        candidate = d / ".env"
        if candidate.is_file():
            return candidate
    return None


def ensure_env() -> Path | None:
    """Разово подмешать `.env` в окружение. Возвращает найденный файл (или None)."""
    global _loaded, _env_file
    if _loaded:
        return _env_file
    _loaded = True
    _env_file = find_env()
    if _env_file is None:
        return None
    try:
        text = _env_file.read_text(encoding="utf-8")
    except OSError:
        return _env_file
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)
    return _env_file


def env_file() -> Path | None:
    """Путь к использованному `.env` — показываем в `status` для диагностики."""
    return ensure_env()


def repo_root() -> Path:
    """Корень проекта: каталог с `.env`, иначе родитель пакета."""
    env = ensure_env()
    return env.parent if env else PKG_ROOT.parent


def app_url() -> str:
    """Базовый адрес FastAPI без хвостового слеша."""
    ensure_env()
    return (os.environ.get("APP_URL") or DEFAULT_APP_URL).strip().rstrip("/")


def internal_token() -> str:
    """Общий секрет внутренних эндпоинтов; пустая строка = не настроен."""
    ensure_env()
    return os.environ.get("INTERNAL_TOKEN", "").strip()


def log_dir() -> Path:
    """Каталог логов проекта (там же лежит drill.log сервера)."""
    return repo_root() / "logs"
