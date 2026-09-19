"""Готовый PDF разбора: печатает Chromium в отдельном сервисе, здесь оркестрация и хранение.

Файл лежит в Object Storage, а не на диске машины: диск 20 ГБ и переживает не каждый релиз, плюс
ссылка с подписью снимает вопрос доступа. В PDF есть дата рождения, поэтому объект закрыт, а
ссылка живёт час.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

from .config import settings
from .store import store


class RenderError(RuntimeError):
    pass


def browser_settings() -> list[dict]:
    """Безопасный startup-снимок отдельного browser-процесса для общей админской сводки."""
    if not settings.browser_url:
        return []
    request = urllib.request.Request(
        f"{settings.browser_url.rstrip('/')}/settings",
        headers={"X-Browser-Secret": settings.browser_secret},
    )
    try:
        with urllib.request.urlopen(request, timeout=3) as response:
            body = json.loads(response.read())
    except (OSError, ValueError, urllib.error.HTTPError) as exc:
        raise RenderError(f"настройки browser-сервиса недоступны: {exc}") from exc
    if (not isinstance(body, dict) or body.get("group") != "backend"
            or not isinstance(body.get("items"), list)):
        raise RenderError("browser-сервис вернул настройки в неожиданном формате")
    return body["items"]


def render(url: str) -> bytes:
    """Отдать URL браузерному сервису и получить PDF."""
    body = json.dumps({"url": url, "secret": settings.browser_secret}).encode()
    request = urllib.request.Request(f"{settings.browser_url.rstrip('/')}/pdf", data=body,
                                     headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=settings.browser_timeout_seconds) as resp:
            pdf = resp.read()
    except urllib.error.HTTPError as exc:
        raise RenderError(f"браузер ответил {exc.code}: {exc.read()[:200].decode(errors='replace')}") from exc
    except OSError as exc:
        raise RenderError(f"браузер недоступен: {exc}") from exc
    if not pdf.startswith(b"%PDF"):
        raise RenderError("ответ браузера не похож на PDF")
    return pdf


def upload(key: str, pdf: bytes) -> None:
    store().upload(key, pdf)


def link(key: str, filename: str | None = None) -> str:
    """Ссылка на готовый файл. Имя задаём явно: ключ хранит номера («<юзер>/<матрица>/<джоб>.pdf»),
    а в загрузках у покупателя должна лежать дата разбора."""
    return store().link(key, filename)
