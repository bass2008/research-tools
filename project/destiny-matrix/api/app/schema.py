"""Схема без миграций: пока идёт разработка, таблицы можно ронять и создавать заново.

    python -m app.schema ensure   создать недостающее и наполнить справочник
    python -m app.schema reset    снести всё и создать заново

Когда пойдут живые продажи, миграции надо вернуть: `reset` уносит платежи.
"""
from __future__ import annotations

import sys

from .config import settings
from .db import Base, SessionLocal, engine
from . import models  # noqa: F401  — модели должны быть импортированы до create_all
from . import tariffs
from .models import User
from .security import hash_password


def seed_admin() -> str | None:
    """Админ должен существовать всегда, в том числе на пустой базе после чистки.

    Пароль ставится только при создании: у живого аккаунта его не перетираем.
    """
    email = next(iter(settings.admins), None)
    if not email:
        return None
    with SessionLocal() as db:
        if db.query(User).filter(User.email == email).first() is None:
            db.add(User(email=email, password_hash=hash_password(settings.admin_password)))
            db.commit()
            return f"{email} (создан, пароль из ADMIN_PASSWORD)"
        return f"{email} (уже есть)"


def add_missing_columns() -> list[str]:
    """create_all не трогает существующие таблицы, поэтому новые колонки доезжают через ALTER —
    иначе пришлось бы ронять таблицу с платежами."""
    from sqlalchemy import inspect, text
    wanted = {
        "users": {
            "last_seen_at": "TIMESTAMP WITH TIME ZONE",
        },
        "payments": {
            "provider": "VARCHAR(16) NOT NULL DEFAULT 'mock'",
            "status": "VARCHAR(24) NOT NULL DEFAULT 'NEW'",
            "pay_url": "VARCHAR(300)",
            "order_id": "VARCHAR(64)",
        },
    }
    added: list[str] = []
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in wanted.items():
            if table not in inspector.get_table_names():
                continue
            have = {c["name"] for c in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name in have:
                    continue
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
                added.append(f"{table}.{name}")
    return added


def drop_retired_tables() -> list[str]:
    """create_all не сносит лишнее: снятая таблица иначе осталась бы на всех живых базах."""
    from sqlalchemy import inspect, text
    retired = ["leads"]
    inspector = inspect(engine)
    have = set(inspector.get_table_names())
    dropped = [name for name in retired if name in have]
    if dropped:
        with engine.begin() as conn:
            for name in dropped:
                conn.execute(text(f"DROP TABLE {name}"))
    return dropped


def revoke_duplicate_rights() -> int:
    """Дубли, оставшиеся от гонки двух платежей: лишнее право не удаляем, а гасим — деньги за
    него уже прошли, и след покупки должен остаться в истории. Без этого уникальный индекс
    (см. Entitlement.__table_args__) не создастся на старой базе."""
    from sqlalchemy import bindparam, inspect, text
    if "entitlements" not in inspect(engine).get_table_names():
        return 0
    with engine.begin() as conn:
        stale = conn.execute(text(
            "SELECT id FROM entitlements WHERE revoked_at IS NULL AND matrix_id IS NOT NULL "
            "AND id NOT IN (SELECT MIN(id) FROM entitlements WHERE revoked_at IS NULL "
            "AND matrix_id IS NOT NULL GROUP BY user_id, matrix_id)"
        )).scalars().all()
        if not stale:
            return 0
        conn.execute(text(
            "UPDATE entitlements SET revoked_at = CURRENT_TIMESTAMP, "
            "note = COALESCE(note, 'дубль оплаты') WHERE id IN :ids"
        ).bindparams(bindparam("ids", expanding=True)), {"ids": list(stale)})
    return len(stale)


def ensure() -> None:
    # порядок важен: индекс уникальности не встанет, пока в таблице лежат дубли
    revoked = revoke_duplicate_rights()
    if revoked:
        print(f"погашено дублей прав: {revoked}")
    Base.metadata.create_all(engine)
    retired = drop_retired_tables()
    if retired:
        print("снятые таблицы удалены: " + ", ".join(retired))
    new_columns = add_missing_columns()
    if new_columns:
        print("добавлены колонки: " + ", ".join(new_columns))
    with SessionLocal() as db:
        rows = tariffs.seed(db)
    admin = seed_admin()
    if admin:
        print(f"админ: {admin}")
    print(f"схема на месте, тарифов: {len(rows)}")
    for t in rows:
        print(f"  {t.id:8s} {t.name:28s} {t.price / 100:8.2f} ₽  "
              f"{'бессрочно' if t.period_days is None else str(t.period_days) + ' дней'}  "
              f"{','.join(t.scopes())}")


def reset() -> None:
    Base.metadata.drop_all(engine)
    print("таблицы снесены")
    ensure()


if __name__ == "__main__":
    {"ensure": ensure, "reset": reset}[sys.argv[1] if len(sys.argv) > 1 else "ensure"]()
