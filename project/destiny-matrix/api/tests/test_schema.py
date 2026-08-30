"""Аддитивные изменения схемы не требуют очистки существующей базы."""
from __future__ import annotations

from sqlalchemy import create_engine, inspect, text

from app import schema


def test_ensure_adds_last_seen_to_existing_users(monkeypatch, tmp_path):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(320) NOT NULL, "
            "password_hash VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL)"
        ))

    monkeypatch.setattr(schema, "engine", engine)
    assert schema.add_missing_columns() == ["users.last_seen_at"]
    assert "last_seen_at" in {column["name"] for column in inspect(engine).get_columns("users")}
    assert schema.add_missing_columns() == [], "повторный ensure не идемпотентен"
    engine.dispose()
