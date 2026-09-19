"""Где лежит готовый PDF. На проде — Object Storage, на стендах — каталог рядом с приложением.

Разводить пришлось из-за счёта: все контуры писали в один боевой бакет, и прогоны e2e накопили
там 28 ГБ отчётов от несуществующих пользователей. Локальная реализация ничего не уносит наружу
и чистит свой каталог при запуске: в контейнере он и так пуст, а при `uvicorn` напрямую копится
от старта до старта.
"""
from __future__ import annotations

import urllib.parse
from pathlib import Path
from typing import Protocol

from .config import settings
from .security import create_file_token


class ReportStore(Protocol):
    def upload(self, key: str, pdf: bytes) -> None: ...

    def link(self, key: str, filename: str | None = None) -> str: ...

    def exists(self, key: str) -> bool: ...


def disposition(filename: str) -> str:
    """Имя файла в загрузках: ключ хранит номера, покупателю нужна дата разбора."""
    safe = filename.replace('"', "").replace("\n", " ")
    ascii_name = "".join(c if c.isascii() and c.isprintable() else "_" for c in safe)
    return f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{urllib.parse.quote(safe)}'


class S3Store:
    def _client(self):
        import boto3
        return boto3.client("s3", endpoint_url=settings.s3_endpoint, region_name=settings.s3_region,
                            aws_access_key_id=settings.s3_access_key,
                            aws_secret_access_key=settings.s3_secret_key)

    def upload(self, key: str, pdf: bytes) -> None:
        self._client().put_object(Bucket=settings.s3_reports_bucket, Key=key, Body=pdf,
                                  ContentType="application/pdf")

    def exists(self, key: str) -> bool:
        """Есть ли файл. Сомнение трактуем в пользу «есть»: на таймауте или 5xx хранилища ответ
        «нет» отправил бы всех подряд печатать заново, по полминуты CPU на каждого."""
        from botocore.exceptions import ClientError
        try:
            self._client().head_object(Bucket=settings.s3_reports_bucket, Key=key)
            return True
        except ClientError as exc:
            code = str(exc.response.get("Error", {}).get("Code", ""))
            status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            return not (code in ("404", "NoSuchKey", "NotFound") or status == 404)
        except Exception:                                   # noqa: BLE001
            return True

    def link(self, key: str, filename: str | None = None) -> str:
        params: dict = {"Bucket": settings.s3_reports_bucket, "Key": key}
        if filename:
            params["ResponseContentDisposition"] = disposition(filename)
        return self._client().generate_presigned_url(
            "get_object", Params=params, ExpiresIn=settings.report_link_ttl_seconds,
        )


class LocalStore:
    """Каталог на диске. Ссылка — такой же одноразовый пропуск на час, как подпись S3: в PDF есть
    дата рождения, поэтому раздавать файлы по предсказуемому пути нельзя."""

    def __init__(self, root: Path | str | None = None) -> None:
        self.root = Path(root or settings.reports_dir)
        self.root.mkdir(parents=True, exist_ok=True)
        self.sweep()

    def sweep(self) -> int:
        """Чистка при запуске. Удаляем только свои файлы: путь можно переопределить переменной,
        и однажды в ней окажется каталог, который сносить нельзя."""
        gone = 0
        for path in self.root.rglob("*.pdf"):
            try:
                path.unlink()
                gone += 1
            except OSError:
                pass
        return gone

    def _path(self, key: str) -> Path:
        target = (self.root / key).resolve()
        if not target.is_relative_to(self.root.resolve()):
            raise ValueError(f"ключ уводит за пределы хранилища: {key}")
        return target

    def upload(self, key: str, pdf: bytes) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(pdf)

    def exists(self, key: str) -> bool:
        try:
            return self._path(key).is_file()
        except ValueError:
            return False

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def link(self, key: str, filename: str | None = None) -> str:
        token = create_file_token(key, filename)
        base = settings.site_url.rstrip("/")
        return f"{base}/api/reports/file?token={urllib.parse.quote(token)}"


_store: ReportStore | None = None


def store() -> ReportStore:
    global _store
    if _store is None:
        _store = LocalStore() if settings.reports_store == "local" else S3Store()
    return _store


def prepare() -> ReportStore:
    """Поднять хранилище при старте приложения. Для локального это и есть момент чистки."""
    reset()
    return store()


def reset() -> None:
    """Сброс выбранной реализации: настройки подменяют тесты."""
    global _store
    _store = None
