"""Схема базы и её миграции.

    python -m app.schema ensure   создать недостающее, применить миграции, наполнить справочник
    python -m app.schema reset    снести всё и создать заново (только для стенда: уносит платежи)

Пустая база создаётся сразу в последнем виде. Живая — проходит миграции по порядку; каждая
применяется один раз, в одной транзакции, и записывается в `schema_migrations`.
"""
from __future__ import annotations

import json
import sqlite3
import sys
from collections.abc import Callable

from sqlalchemy import inspect
from sqlalchemy.schema import CreateIndex, CreateTable

from .config import settings
from .db import Base, SessionLocal, engine
from . import models  # noqa: F401  — модели должны быть импортированы до create_all
from . import errors, offers
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


# --- База до миграций -------------------------------------------------------------------------
# Старые базы доводились до текущего вида добавлением колонок. Эти шаги нужны только базе, которая
# ещё не прошла миграцию 001: она читает старые таблицы именно в этом виде.

def add_missing_columns() -> list[str]:
    from sqlalchemy import text
    wanted = {
        "users": {
            "last_seen_at": "TIMESTAMP WITH TIME ZONE",
        },
        "report_jobs": {
            "locale": "VARCHAR(16) NOT NULL DEFAULT '" + ("en" if settings.site_lang == "en" else "ru") + "'",
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
    from sqlalchemy import text
    retired = ["leads"]
    have = set(inspect(engine).get_table_names())
    dropped = [name for name in retired if name in have]
    if dropped:
        with engine.begin() as conn:
            for name in dropped:
                conn.execute(text(f"DROP TABLE {name}"))
    return dropped


def revoke_duplicate_rights() -> int:
    """Дубли, оставшиеся от гонки двух платежей: лишнее право не удаляем, а гасим — деньги за
    него уже прошли, и след покупки должен остаться в истории. Без этого уникальный индекс
    на старой базе не создастся."""
    from sqlalchemy import bindparam, text
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


# --- Миграции ---------------------------------------------------------------------------------

def _table_ddl(name: str, as_name: str | None = None) -> str:
    ddl = str(CreateTable(Base.metadata.tables[name]).compile(dialect=engine.dialect)).strip()
    return ddl.replace(f"CREATE TABLE {name} ", f"CREATE TABLE {as_name} ", 1) if as_name else ddl


def _index_ddl(name: str) -> list[str]:
    return [str(CreateIndex(index).compile(dialect=engine.dialect)).strip()
            for index in sorted(Base.metadata.tables[name].indexes, key=lambda i: i.name)]


def _create(cur: sqlite3.Cursor, name: str) -> None:
    cur.execute(_table_ddl(name))
    for ddl in _index_ddl(name):
        cur.execute(ddl)


def _tables(cur: sqlite3.Cursor) -> set[str]:
    return {r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def _count(cur: sqlite3.Cursor, table: str) -> int:
    return cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


def _access_of(scope: list[str]) -> tuple[list[str], bool, bool]:
    """Прежний вид доступа → продукты, привязка к разбору, хранение без ограничения."""
    if "all" in scope:
        return ["*"], False, "matrix" in scope
    return ["personal"], True, "matrix" in scope


def migrate_products(cur: sqlite3.Cursor) -> dict:
    """001. Продукты: дата → разбор, тариф → предложение, платёж → заказ и попытка оплаты.

    Номера сохраняются: разбор получает номер матрицы, заказ — номер платежа. Поэтому старые
    адреса `/matrices/<id>` и `/report?m=<id>`, ссылки в письмах и ключи PDF в хранилище остаются
    верными, а права и задания печати переезжают простым переименованием колонки.
    """
    have = _tables(cur)
    before = {t: _count(cur, t) for t in ("tariffs", "matrices", "payments", "entitlements",
                                          "report_jobs") if t in have}

    _create(cur, "offers")
    if "tariffs" in have:
        for row in cur.execute("SELECT id, name, price, scope, period_days FROM tariffs").fetchall():
            products, per_reading, store = _access_of(json.loads(row[3]))
            cur.execute("INSERT INTO offers (id, name, price, currency, channel, products, per_reading, "
                        "store_unlimited, period_days, public, sort) VALUES (?, ?, ?, 'RUB', 'site', ?, ?, ?, ?, ?, ?)",
                        (row[0], row[1], row[2], json.dumps(products), per_reading, store, row[4],
                         row[0] in (offers.SINGLE_ID, offers.MONTH_ID),
                         {offers.SINGLE_ID: 10, offers.MONTH_ID: 30}.get(row[0], 50)))

    _create(cur, "readings")
    if "matrices" in have:
        for row in cur.execute("SELECT id, user_id, birth, sex, title, created_at FROM matrices").fetchall():
            birth = str(row[2])[:10]
            cur.execute("INSERT INTO readings (id, user_id, product, inputs, subject_key, title, created_at) "
                        "VALUES (?, ?, 'personal', ?, ?, ?, ?)",
                        (row[0], row[1], json.dumps({"birth": birth, "sex": row[3]}),
                         f"{birth}|{row[3]}", row[4], row[5]))

    _create(cur, "purchases")
    if "payments" in have:
        for row in cur.execute("SELECT id, user_id, tariff_body, amount, matrix_id, created_at, paid_at, "
                               "refunded_at FROM payments").fetchall():
            body = json.loads(row[2])
            products, per_reading, store = _access_of(body.get("scope", []))
            body |= {"products": products, "per_reading": per_reading, "store_unlimited": store,
                     "currency": "RUB", "channel": "site"}
            cur.execute("INSERT INTO purchases (id, user_id, offer_id, offer_body, reading_id, amount, "
                        "currency, channel, created_at, paid_at, refunded_at) "
                        "VALUES (?, ?, ?, ?, ?, ?, 'RUB', 'site', ?, ?, ?)",
                        (row[0], row[1], body.get("id", ""), json.dumps(body, ensure_ascii=False),
                         row[4], row[3], row[5], row[6], row[7]))
        cur.execute(_table_ddl("payments", "new_payments"))
        cur.execute("INSERT INTO new_payments (id, user_id, purchase_id, amount, created_at, paid_at, "
                    "refunded_at, external_id, provider, status, pay_url, order_id) "
                    "SELECT id, user_id, id, amount, created_at, paid_at, refunded_at, external_id, "
                    "provider, status, pay_url, order_id FROM payments")
        cur.execute("DROP TABLE payments")
        cur.execute("ALTER TABLE new_payments RENAME TO payments")
        for ddl in _index_ddl("payments"):
            cur.execute(ddl)
    else:
        _create(cur, "payments")

    if "entitlements" in have:
        cur.execute(_table_ddl("entitlements", "new_entitlements"))
        rows = cur.execute("SELECT id, user_id, payment_id, scope, matrix_id, starts_at, expires_at, "
                           "revoked_at, note FROM entitlements").fetchall()
        for row in rows:
            products, per_reading, store = _access_of(json.loads(row[3]))
            cur.execute("INSERT INTO new_entitlements (id, user_id, purchase_id, products, per_reading, "
                        "store_unlimited, reading_id, starts_at, expires_at, revoked_at, note) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (row[0], row[1], row[2], json.dumps(products), per_reading, store, row[4],
                         row[5], row[6], row[7], row[8]))
        cur.execute("DROP TABLE entitlements")
        cur.execute("ALTER TABLE new_entitlements RENAME TO entitlements")
        for ddl in _index_ddl("entitlements"):
            # Дубли старой базы нормализует миграция 007 перед созданием этого индекса.
            if "ux_entitlement_active_purchase" not in ddl:
                cur.execute(ddl)
    else:
        _create(cur, "entitlements")

    if "report_jobs" in have:
        cur.execute(_table_ddl("report_jobs", "new_report_jobs"))
        cur.execute("INSERT INTO new_report_jobs (id, user_id, reading_id, status, locale, object_key, "
                    "size_bytes, error, created_at, started_at, finished_at) "
                    "SELECT id, user_id, matrix_id, status, locale, object_key, size_bytes, error, "
                    "created_at, started_at, finished_at FROM report_jobs")
        cur.execute("DROP TABLE report_jobs")
        cur.execute("ALTER TABLE new_report_jobs RENAME TO report_jobs")
        for ddl in _index_ddl("report_jobs"):
            cur.execute(ddl)
    else:
        _create(cur, "report_jobs")

    for old in ("matrices", "tariffs"):
        if old in have:
            cur.execute(f"DROP TABLE {old}")

    after = {"tariffs": _count(cur, "offers"), "matrices": _count(cur, "readings"),
             "payments": _count(cur, "purchases"), "entitlements": _count(cur, "entitlements"),
             "report_jobs": _count(cur, "report_jobs")}
    lost = {t: (n, after[t]) for t, n in before.items() if after[t] != n}
    if lost or _count(cur, "payments") != after["payments"]:
        raise RuntimeError(f"миграция 001 потеряла строки: {lost}")
    return {"было": before, "стало": after}


def subscription_price(cur: sqlite3.Cursor) -> dict:
    """002. Подписка «Три месяца без ограничений» открывает все продукты: 490 ₽ (владелец, 09.10.2026).
    Снимки прошлых заказов не трогаются — история цен не переписывается."""
    cur.execute("UPDATE offers SET price = 49000 WHERE id = 'month'")
    return {"подписка": cur.rowcount}


def granted_beside_bought(cur: sqlite3.Cursor) -> dict:
    """003. На разбор — одно купленное и одно выданное право: выданное админом поверх покупки
    переживает её возврат. Прежний индекс допускал одно право на разбор вообще."""
    names = ("ux_entitlement_active_reading", "ux_entitlement_granted_reading")
    for name in names:
        cur.execute(f"DROP INDEX IF EXISTS {name}")
    for index in Base.metadata.tables["entitlements"].indexes:
        if index.name in names:
            cur.execute(str(CreateIndex(index).compile(dialect=engine.dialect)).strip())
    return {"индексы прав": len(names)}


def subscription_rename(cur: sqlite3.Cursor) -> dict:
    """004. Подписка называется «Подписка на 3 месяца» (владелец, 09.10.2026). Имя, которое владелец
    поменял сам, не трогается; снимки прошлых заказов — тоже."""
    cur.execute("UPDATE offers SET name = 'Подписка на 3 месяца' "
                "WHERE id = 'month' AND name = 'Три месяца без ограничений'")
    return {"подписка": cur.rowcount}


def subscription_price_390(cur: sqlite3.Cursor) -> dict:
    """005. Подписка 390 ₽ (владелец, 11.10.2026). Снимки прошлых заказов не трогаются."""
    cur.execute("UPDATE offers SET price = 39000 WHERE id = 'month'")
    return {"подписка": cur.rowcount}


def prices_390_590(cur: sqlite3.Cursor) -> dict:
    """006. Разборы по 390 ₽, подписка 590 ₽ за 3 месяца (24.10.2026).
    Меняется только витрина: суммы и снимки существующих заказов сохраняются.
    """
    cur.execute("UPDATE offers SET price = 39000 WHERE id IN ('single', 'pair')")
    readings = cur.rowcount
    cur.execute("UPDATE offers SET price = 59000 WHERE id = 'month'")
    return {"разборы": readings, "подписка": cur.rowcount}


def unique_purchase_right(cur: sqlite3.Cursor) -> dict:
    """007. Один активный доступ на заказ, включая подписки без reading_id.
    Старые дубли сохраняются в истории отозванными; срок оставшегося права не меняется.
    """
    cur.execute("UPDATE entitlements SET revoked_at = CURRENT_TIMESTAMP, "
                "note = COALESCE(note, 'дубль права по заказу') "
                "WHERE purchase_id IS NOT NULL AND revoked_at IS NULL AND id NOT IN "
                "(SELECT MIN(id) FROM entitlements WHERE purchase_id IS NOT NULL "
                "AND revoked_at IS NULL GROUP BY purchase_id)")
    duplicates = cur.rowcount
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_entitlement_active_purchase "
                "ON entitlements(purchase_id) WHERE purchase_id IS NOT NULL AND revoked_at IS NULL")
    return {"дубли прав отозваны": duplicates}


def static_pair_chakras(cur: sqlite3.Cursor) -> dict:
    """008. Чакры входят в корпус: очередь и ожидания старого механизма больше не нужны."""
    removed = 0
    if "work_tasks" in _tables(cur):
        cur.execute("DELETE FROM work_tasks WHERE kind = 'pair_chakras'")
        removed = cur.rowcount
    for table in ("pair_chakra_waits", "pair_chakra_texts"):
        cur.execute(f"DROP TABLE IF EXISTS {table}")
    return {"старые задачи чакр удалены": removed}


def work_task_identity(cur: sqlite3.Cursor) -> dict:
    """009. Удаление задачи не освобождает её номер для следующей задачи."""
    if "work_tasks" not in _tables(cur):
        return {"таблица появится при создании схемы": True}
    ddl = cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='work_tasks'").fetchone()[0]
    if "AUTOINCREMENT" in ddl.upper():
        return {"повторное использование ID уже отключено": True}
    before = _count(cur, "work_tasks")
    columns = ", ".join(column.name for column in Base.metadata.tables["work_tasks"].columns)
    cur.execute(_table_ddl("work_tasks", "new_work_tasks"))
    cur.execute(f"INSERT INTO new_work_tasks ({columns}) SELECT {columns} FROM work_tasks")
    cur.execute("DROP TABLE work_tasks")
    cur.execute("ALTER TABLE new_work_tasks RENAME TO work_tasks")
    for ddl in _index_ddl("work_tasks"):
        cur.execute(ddl)
    if _count(cur, "work_tasks") != before:
        raise RuntimeError("миграция 009 потеряла задачи")
    return {"задачи сохранены": before}


MIGRATIONS: list[tuple[str, Callable[[sqlite3.Cursor], dict]]] = [
    ("001_products", migrate_products),
    ("002_subscription_price", subscription_price),
    ("003_granted_beside_bought", granted_beside_bought),
    ("004_subscription_rename", subscription_rename),
    ("005_subscription_price_390", subscription_price_390),
    ("006_prices_390_590", prices_390_590),
    ("007_unique_purchase_right", unique_purchase_right),
    ("008_static_pair_chakras", static_pair_chakras),
    ("009_work_task_identity", work_task_identity),
]


def _applied(cur: sqlite3.Cursor) -> set[str]:
    cur.execute("CREATE TABLE IF NOT EXISTS schema_migrations "
                "(id VARCHAR(64) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL)")
    return {r[0] for r in cur.execute("SELECT id FROM schema_migrations")}


def migrate() -> list[str]:
    """Применить недостающие миграции. Внешние ключи на время переноса выключены: таблицы
    пересобираются, и проверка идёт целиком в конце — `foreign_key_check` до COMMIT."""
    raw = engine.raw_connection()
    con: sqlite3.Connection = raw.driver_connection
    previous = con.isolation_level
    con.isolation_level = None
    done: list[str] = []
    try:
        cur = con.cursor()
        fresh = "users" not in _tables(cur)
        applied = _applied(cur)
        if fresh:
            for name, _ in MIGRATIONS:
                cur.execute("INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)", (name,))
            return done
        pending = [(name, step) for name, step in MIGRATIONS if name not in applied]
        if not pending:
            return done
        cur.execute("PRAGMA foreign_keys=OFF")
        try:
            for name, step in pending:
                cur.execute("BEGIN IMMEDIATE")
                try:
                    report = step(cur)
                    broken = cur.execute("PRAGMA foreign_key_check").fetchall()
                    if broken:
                        raise RuntimeError(f"миграция {name}: нарушены внешние ключи {broken[:5]}")
                    cur.execute("INSERT INTO schema_migrations (id) VALUES (?)", (name,))
                    cur.execute("COMMIT")
                except Exception:
                    cur.execute("ROLLBACK")
                    raise
                done.append(f"{name}: {report}")
        finally:
            cur.execute("PRAGMA foreign_keys=ON")
    finally:
        con.isolation_level = previous
        raw.close()
    return done


def ensure() -> None:
    have = set(inspect(engine).get_table_names())
    if "users" in have and "matrices" in have:
        # база до миграции 001: довести старые таблицы до вида, который она читает
        revoked = revoke_duplicate_rights()
        if revoked:
            print(f"погашено дублей прав: {revoked}")
        new_columns = add_missing_columns()
        if new_columns:
            print("добавлены колонки: " + ", ".join(new_columns))
    retired = drop_retired_tables()
    if retired:
        print("снятые таблицы удалены: " + ", ".join(retired))
    for line in migrate():
        print(f"миграция {line}")
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        rows = offers.seed(db)
    admin = seed_admin()
    if admin:
        print(f"админ: {admin}")
    trimmed = errors.trim()
    if trimmed:
        print(f"удалено старых ошибок: {trimmed}")
    print(f"схема на месте, предложений: {len(rows)}")
    for o in rows:
        print(f"  {o.id:8s} {o.name:28s} {o.price / 100:8.2f} ₽  "
              f"{'бессрочно' if o.period_days is None else str(o.period_days) + ' дней'}  "
              f"{','.join(o.product_list())}{'' if o.public else '  скрыто'}")


def reset() -> None:
    Base.metadata.drop_all(engine)
    print("таблицы снесены")
    ensure()


if __name__ == "__main__":
    {"ensure": ensure, "reset": reset}[sys.argv[1] if len(sys.argv) > 1 else "ensure"]()
