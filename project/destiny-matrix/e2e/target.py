"""Определение стенда по hostname, не по подстроке полного URL."""
from urllib.parse import urlsplit


def is_remote(base: str) -> bool:
    return urlsplit(base).hostname in {
        "arcana-sense.ru", "arcana-sense.com",
        "test.arcana-sense.ru", "test.arcana-sense.com",
    }
