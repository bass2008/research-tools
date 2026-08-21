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


class RenderError(RuntimeError):
    pass


def _client():
    import boto3
    return boto3.client("s3", endpoint_url=settings.s3_endpoint, region_name=settings.s3_region,
                        aws_access_key_id=settings.s3_access_key,
                        aws_secret_access_key=settings.s3_secret_key)


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
    _client().put_object(Bucket=settings.s3_reports_bucket, Key=key, Body=pdf,
                         ContentType="application/pdf")


def link(key: str) -> str:
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_reports_bucket, "Key": key},
        ExpiresIn=settings.report_link_ttl_seconds,
    )
