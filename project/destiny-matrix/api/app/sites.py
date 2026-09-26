"""Публичный контекст запроса. BFF передаёт origin из проверенного профиля Host.

API не принимает произвольные URL от браузера и не выбирает домен по языку.
Тот же SITE_PROFILES используется фронтендом; платёжные подключения явно перечислены
в профилях. Отсутствие подключения означает отсутствие оплаты, а не бесплатный доступ.
"""
from __future__ import annotations

import json
import re
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import urlsplit

from .config import settings
from .http_errors import LocalizedHTTPException
from .i18n import say

HEADER = "X-Arcana-Site-Origin"


@dataclass(frozen=True)
class Connection:
    id: str
    provider: str
    notification_url: str


@dataclass(frozen=True)
class Site:
    origin: str
    default_locale: str
    locales: tuple[str, ...]
    payments: tuple[Connection, ...]


def _origin(value: str) -> str:
    url = urlsplit(value)
    if (url.scheme not in ("http", "https") or not url.hostname or url.username
            or url.password or url.query or url.fragment or url.path not in ("", "/")):
        raise ValueError("SITE_PROFILES: invalid origin")
    return value.rstrip("/")


@lru_cache(maxsize=8)
def _profiles(raw: str) -> tuple[Site, ...]:
    data = json.loads(raw or "[]")
    if not isinstance(data, list):
        raise ValueError("SITE_PROFILES must be an array")
    sites = []
    connections: dict[str, Connection] = {}
    for row in data:
        origin = _origin(row["origin"])
        locales = tuple(row["locales"])
        default = row["defaultLocale"]
        if default not in locales or not locales or any(x not in ("ru", "en") for x in locales):
            raise ValueError("SITE_PROFILES: invalid locales")
        allowed = []
        for item in row.get("payments", []):
            connection = Connection(item["id"], item["provider"], item["notificationUrl"])
            if not all(re.fullmatch(r"[a-z][a-z0-9_-]{0,31}", x)
                       for x in (connection.id, connection.provider)):
                raise ValueError("SITE_PROFILES: invalid payment connection")
            previous = connections.setdefault(connection.id, connection)
            if previous != connection or connection in allowed:
                raise ValueError("SITE_PROFILES: conflicting payment connection")
            allowed.append(connection)
        if any(s.origin == origin for s in sites):
            raise ValueError("SITE_PROFILES: duplicate origin")
        sites.append(Site(origin, default, locales, tuple(allowed)))
    for connection in connections.values():
        url = urlsplit(connection.notification_url)
        owner = next((s for s in sites if s.origin == f"{url.scheme}://{url.netloc}"), None)
        if (owner is None or connection not in owner.payments or url.query or url.fragment
                or url.path != f"/api/payments/notify/{connection.id}"):
            raise ValueError("SITE_PROFILES: callback must belong to a site allowing the connection")
    return tuple(sites)


def profiles() -> tuple[Site, ...]:
    return _profiles(settings.site_profiles)


def find(origin: str) -> Site | None:
    return next((s for s in profiles() if s.origin == origin), None)


_site: ContextVar[Site | None] = ContextVar("site", default=None)


def current() -> Site:
    site = _site.get()
    if site is None:
        raise LocalizedHTTPException(400, detail=lambda: say("site.invalid"))
    return site


@contextmanager
def using_site(site: Site | None):
    token = _site.set(site)
    try:
        yield
    finally:
        _site.reset(token)


def connection_by_id(identifier: str) -> Connection | None:
    return next((c for s in profiles() for c in s.payments if c.id == identifier), None)


def payment_connection(payment) -> Connection | None:
    body = payment.body()
    if "connection_id" in body:
        found = connection_by_id(body["connection_id"])
        return found if found and found.provider == payment.provider else None
    # Старые российские платежи продолжают обслуживаться своим единственным подключением.
    # Переноса платежей .com нет: на этом домене их не было.
    matches = {c for s in profiles() for c in s.payments if c.provider == payment.provider}
    return next(iter(matches)) if len(matches) == 1 else None


def payment_site(payment) -> Site:
    origin = payment.body().get("site_origin")
    if origin:
        site = find(origin)
    else:
        connection = payment_connection(payment)
        url = urlsplit(connection.notification_url) if connection else None
        site = find(f"{url.scheme}://{url.netloc}") if url else None
    if site is None:
        raise ValueError("Payment site is not configured")
    return site
