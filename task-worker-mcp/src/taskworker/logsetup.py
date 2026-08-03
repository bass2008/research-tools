"""Файловый лог пакета — `logs/taskworker.log` рядом с `drill.log` сервера.

stdout не трогаем никогда: по нему идёт MCP-протокол (`taskworker mcp`) и короткий JSON списка
джобов (`taskworker wait-jobs`). Поэтому лог — в файл, а предупреждения и ошибки при желании
дублируются в stderr. Отдельный файл (а не `drill.log`) — чтобы кнопка «Удалить всё» на вкладке
Лог не стирала диагностику транспорта.
"""

from __future__ import annotations

import logging
import sys

from .config import log_dir

LOG_FILE = "taskworker.log"
_FORMAT = logging.Formatter("%(asctime)s %(name)s %(levelname)s: %(message)s", "%Y-%m-%d %H:%M:%S")


def setup_logging(component: str, stderr: bool = False) -> logging.Logger:
    """Настроить лог (один раз на процесс) и вернуть логгер компонента.

    `stderr=True` — дополнительно сыпать в stderr, но только WARNING и выше: вывод команды читает
    LLM-клиент, и лишние INFO-строки ему только мешают."""
    root = logging.getLogger("taskworker")
    root.setLevel(logging.INFO)
    root.propagate = False
    # httpx сыплет INFO на каждый запрос, а MCP-SDK вешает на root-логгер вывод в stderr —
    # в диагностике это чистый шум, наши строки информативнее.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    if not any(isinstance(h, logging.FileHandler) for h in root.handlers):
        try:
            directory = log_dir()
            directory.mkdir(parents=True, exist_ok=True)
            handler = logging.FileHandler(directory / LOG_FILE, encoding="utf-8")
            handler.setFormatter(_FORMAT)
            root.addHandler(handler)
        except OSError:
            pass                      # без файла работаем дальше: лог не критичен для транспорта
    if stderr and not any(isinstance(h, logging.StreamHandler)
                          and not isinstance(h, logging.FileHandler) for h in root.handlers):
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(_FORMAT)
        handler.setLevel(logging.WARNING)
        root.addHandler(handler)
    return logging.getLogger(f"taskworker.{component}")
