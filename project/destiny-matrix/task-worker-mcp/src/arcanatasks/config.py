"""Стенды исполнителя — по файлу на стенд вне репозитория: `~/.config/arcana/worker-<стенд>.env`.

    ARCANA_URL=https://test.arcana-sense.ru     # прод: https://arcana-sense.ru, локально: http://localhost:3000
    ARCANA_WORKER_TOKEN=...                      # docker exec <api стенда> python -m app.worktasks
    TEST_BASIC_USER=... TEST_BASIC_PASSWORD=...  # только тест: Basic Auth

Есть файл — стенд обслуживается; нет — пропускается. Каталог меняет `ARCANA_TASKS_DIR`.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

@dataclass(frozen=True)
class Stand:
    name: str
    file: Path
    url: str
    token: str
    basic: tuple[str, str] | None


def config_dir() -> Path:
    return Path(os.environ.get("ARCANA_TASKS_DIR") or Path.home() / ".config" / "arcana").expanduser()


def _read(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value
    return values


def stands() -> dict[str, Stand]:
    found = {}
    for path in sorted(config_dir().glob("worker-*.env")):
        values = _read(path)
        user = values.get("ARCANA_BASIC_USER") or values.get("TEST_BASIC_USER")
        password = values.get("ARCANA_BASIC_PASSWORD") or values.get("TEST_BASIC_PASSWORD")
        name = path.stem.removeprefix("worker-")
        found[name] = Stand(name, path, (values.get("ARCANA_URL") or "").rstrip("/"),
                            values.get("ARCANA_WORKER_TOKEN", ""), (user, password) if user and password else None)
    return found


def stand(name: str) -> Stand:
    found = stands()
    if name not in found:
        raise KeyError(f"стенда {name!r} нет: нужен файл {config_dir() / f'worker-{name}.env'}")
    return found[name]


def log_dir() -> Path:
    return Path.home() / ".cache" / "arcana-tasks"
