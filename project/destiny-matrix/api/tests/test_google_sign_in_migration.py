from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session

from app import schema
from app.db import Base
from app.models import GoogleAuthChallenge, GoogleIdentity, User


def test_google_migration_preserves_existing_password_accounts_and_is_repeatable(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'before-google.db'}")
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("INSERT INTO users(id,email,password_hash,created_at,auth_version) "
                                   "VALUES(1,'existing@example.com','unchanged-hash',CURRENT_TIMESTAMP,7)")
        connection.exec_driver_sql("DROP TABLE google_auth_challenges")
        connection.exec_driver_sql("DROP TABLE google_identities")
        connection.exec_driver_sql("ALTER TABLE users DROP COLUMN has_password")
        connection.exec_driver_sql("CREATE TABLE schema_migrations(id TEXT PRIMARY KEY)")
        for name, _ in schema.MIGRATIONS:
            if name != "015_google_sign_in":
                connection.exec_driver_sql("INSERT INTO schema_migrations(id) VALUES(?)", (name,))
    monkeypatch.setattr(schema, "engine", engine)
    assert len(schema.migrate()) == 1
    assert schema.migrate() == []
    with Session(engine) as db:
        user = db.get(User, 1)
        assert user.has_password is True
        assert user.password_hash == "unchanged-hash" and user.auth_version == 7
        assert db.query(GoogleIdentity).count() == db.query(GoogleAuthChallenge).count() == 0
    assert {"google_identities", "google_auth_challenges"}.issubset(inspect(engine).get_table_names())
    with engine.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    engine.dispose()
