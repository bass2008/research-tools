"""Хранилище отчётов: локальная реализация должна вести себя как S3, иначе стенды проверяют не то."""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import jwt
import pytest

from app import store as store_mod
from app.config import settings
from app.security import create_file_token, read_file_token
from app.store import LocalStore, S3Store, disposition


@pytest.fixture
def local(tmp_path, monkeypatch) -> LocalStore:
    monkeypatch.setattr(settings, "reports_store", "local")
    monkeypatch.setattr(settings, "reports_dir", str(tmp_path))
    store_mod.reset()
    return LocalStore(tmp_path)


def test_local_store_keeps_and_returns_the_file(local, tmp_path):
    local.upload("7/3/9.pdf", b"%PDF-1.4 fake")
    assert (tmp_path / "7" / "3" / "9.pdf").exists()
    assert local.read("7/3/9.pdf") == b"%PDF-1.4 fake"


def test_start_wipes_old_files(tmp_path, monkeypatch):
    """Стенд поднимают по десять раз на дню, а файлы по 3 МБ. Чистка при запуске — вместо чистки
    бакета, в который раньше сваливались прогоны всех контуров разом."""
    monkeypatch.setattr(settings, "reports_dir", str(tmp_path))
    (tmp_path / "1" / "1").mkdir(parents=True)
    (tmp_path / "1" / "1" / "1.pdf").write_bytes(b"%PDF-1.4 old")
    keep = tmp_path / "заметка.txt"
    keep.write_text("не наш файл")

    fresh = LocalStore(tmp_path)

    assert not (tmp_path / "1" / "1" / "1.pdf").exists(), "старый отчёт пережил запуск"
    assert keep.exists(), "чистка снесла чужой файл, а должна трогать только свои pdf"
    assert fresh.sweep() == 0


def test_key_cannot_escape_the_directory(local):
    """Ключ приходит из базы, но подниматься по дереву им нельзя ни при каких условиях."""
    with pytest.raises(ValueError):
        local.upload("../../etc/passwd.pdf", b"%PDF")


def test_link_is_a_signed_pass_not_a_plain_path(local):
    url = local.link("7/3/9.pdf", "Разбор 15.07.1990.pdf")
    assert "/api/reports/file?token=" in url
    assert "7/3/9.pdf" not in url, "ключ виден в ссылке: путь становится угадываемым"
    token = url.split("token=", 1)[1]
    from urllib.parse import unquote
    assert read_file_token(unquote(token)) == ("7/3/9.pdf", "Разбор 15.07.1990.pdf")


def test_expired_pass_is_refused(monkeypatch):
    monkeypatch.setattr(settings, "report_link_ttl_seconds", 60)
    token = create_file_token("7/3/9.pdf", "имя.pdf")
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    payload["exp"] = int((dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=1)).timestamp())
    stale = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    assert read_file_token(stale) is None


def test_pass_of_another_kind_is_refused():
    """Пропуск на печать не должен открывать файл: у токенов разные права."""
    from app.security import create_print_token
    assert read_file_token(create_print_token(3, 7)) is None


def test_filename_survives_cyrillic_in_both_stores():
    """Имя уезжает в заголовок: у S3 через ResponseContentDisposition, у нас — тем же текстом."""
    value = disposition("Разбор 15.07.1990.pdf")
    assert value.startswith("attachment; ")
    assert "filename*=UTF-8''" in value
    assert "%D0%A0" in value


def test_choice_follows_settings(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "reports_dir", str(tmp_path))
    monkeypatch.setattr(settings, "reports_store", "local")
    store_mod.reset()
    assert isinstance(store_mod.store(), LocalStore)

    monkeypatch.setattr(settings, "reports_store", "s3")
    store_mod.reset()
    assert isinstance(store_mod.store(), S3Store)
    store_mod.reset()


def test_printing_is_enabled_without_s3_keys_when_local(monkeypatch):
    """Стенду ключи облака больше не нужны — иначе печать на нём просто выключена."""
    monkeypatch.setattr(settings, "browser_url", "http://browser:8080")
    monkeypatch.setattr(settings, "s3_reports_bucket", "")
    monkeypatch.setattr(settings, "s3_access_key", "")
    monkeypatch.setattr(settings, "reports_store", "local")
    monkeypatch.setattr(settings, "reports_dir", "/tmp/arcana-reports")
    assert settings.pdf_enabled is True

    monkeypatch.setattr(settings, "reports_store", "s3")
    assert settings.pdf_enabled is False


def test_file_endpoint_serves_only_with_a_valid_pass(client, tmp_path, monkeypatch):
    """Сквозная проверка выдачи: подпись, имя в заголовке и отказ просроченному пропуску."""
    monkeypatch.setattr(settings, "reports_store", "local")
    monkeypatch.setattr(settings, "reports_dir", str(tmp_path))
    store_mod.reset()
    store_mod.store().upload("7/3/9.pdf", b"%PDF-1.4 body")

    token = create_file_token("7/3/9.pdf", "Разбор 15.07.1990.pdf")
    ok = client.get("/api/reports/file", params={"token": token})
    assert ok.status_code == 200
    assert ok.content == b"%PDF-1.4 body"
    assert ok.headers["content-type"] == "application/pdf"
    assert "filename*=UTF-8''" in ok.headers["content-disposition"]

    assert client.get("/api/reports/file", params={"token": "x" * 20}).status_code == 403
    missing = client.get("/api/reports/file",
                         params={"token": create_file_token("нет/такого.pdf", "")})
    assert missing.status_code == 404
    store_mod.reset()


def test_file_endpoint_is_closed_when_the_store_is_s3(client, monkeypatch):
    """На проде файлы отдаёт само хранилище по подписи, а этот маршрут существовать не должен."""
    monkeypatch.setattr(settings, "reports_store", "s3")
    store_mod.reset()
    answer = client.get("/api/reports/file", params={"token": create_file_token("7/3/9.pdf", "")})
    assert answer.status_code == 404
    store_mod.reset()


def test_app_start_wipes_the_directory(tmp_path, monkeypatch):
    """Чистка привязана к старту приложения, а не к первой печати: иначе снесёт файл, ссылку на
    который уже отдали покупателю."""
    monkeypatch.setattr(settings, "reports_store", "local")
    monkeypatch.setattr(settings, "reports_dir", str(tmp_path))
    (tmp_path / "5" / "5").mkdir(parents=True)
    (tmp_path / "5" / "5" / "5.pdf").write_bytes(b"%PDF-1.4 stale")

    store_mod.prepare()

    assert list(tmp_path.rglob("*.pdf")) == []
    store_mod.reset()


def test_exists_sees_the_file_and_its_absence(local):
    local.upload("7/3/9.pdf", b"%PDF-1.4 body")
    assert local.exists("7/3/9.pdf") is True
    assert local.exists("7/3/404.pdf") is False
    assert local.exists("../../etc/passwd.pdf") is False


def test_s3_doubt_counts_as_present(monkeypatch):
    """Недоступное хранилище не должно отправлять всех печатать заново: полминуты CPU на каждого."""
    from botocore.exceptions import ClientError
    s3 = S3Store()

    class Missing:
        def head_object(self, **kw):
            raise ClientError({"Error": {"Code": "404"}, "ResponseMetadata": {"HTTPStatusCode": 404}},
                              "HeadObject")

    class Broken:
        def head_object(self, **kw):
            raise ClientError({"Error": {"Code": "500"}, "ResponseMetadata": {"HTTPStatusCode": 500}},
                              "HeadObject")

    class Dead:
        def head_object(self, **kw):
            raise OSError("сеть недоступна")

    monkeypatch.setattr(S3Store, "_client", lambda self: Missing())
    assert s3.exists("3/1/1.pdf") is False
    monkeypatch.setattr(S3Store, "_client", lambda self: Broken())
    assert s3.exists("3/1/1.pdf") is True
    monkeypatch.setattr(S3Store, "_client", lambda self: Dead())
    assert s3.exists("3/1/1.pdf") is True
