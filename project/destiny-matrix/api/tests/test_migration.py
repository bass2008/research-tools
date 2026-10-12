"""Миграция 001 на базе в прежнем виде: даты, тарифы и платежи становятся разборами,
предложениями и заказами без потери строк, номеров и прав."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session, sessionmaker

from app import access, errors, schema
from app.models import Entitlement, Offer, Payment, Purchase, Reading, ReportJob, User, WorkTask

V0 = Path(__file__).parent / "fixtures" / "schema-v0.sql"

SINGLE = {"id": "single", "name": "Полный разбор одной даты", "price": 25000, "scope": ["single"],
          "period_days": None, "locale": "ru", "site_origin": "https://arcana-sense.ru",
          "connection_id": "tbank", "display_name": "Полный разбор одной даты"}
MONTH = {"id": "month", "name": "Три месяца без ограничений", "price": 24000,
         "scope": ["single", "matrix", "all"], "period_days": 90}


def old_base(path: Path, *, legacy_columns: bool = False) -> None:
    """База в виде до миграции. `legacy_columns` — ещё старше: без колонок, которые доезжали
    через ALTER, как на самых первых живых базах."""
    ddl = V0.read_text()
    if legacy_columns:
        for column in ("provider VARCHAR(16) DEFAULT 'mock' NOT NULL, \n\t",
                       "status VARCHAR(24) DEFAULT 'NEW' NOT NULL, \n\t",
                       "pay_url VARCHAR(300), \n\t", "order_id VARCHAR(64), \n\t",
                       "locale VARCHAR(16) NOT NULL, \n\t"):
            assert column in ddl
            ddl = ddl.replace(column, "", 1)
        ddl = ddl.replace("CREATE INDEX ix_payments_order_id ON payments (order_id);\n", "")
    con = sqlite3.connect(path)
    con.executescript(ddl)
    rows = [
        "INSERT INTO users (id, email, password_hash) VALUES (1, 'a@example.ru', 'x'), "
        "(2, 'b@example.ru', 'x'), (3, 'c@example.ru', 'x')",
        "INSERT INTO tariffs VALUES ('single', 'Полный разбор одной даты', 25000, '[\"single\"]', NULL), "
        "('month', 'Три месяца без ограничений', 24000, '[\"single\", \"matrix\", \"all\"]', 90), "
        "('promo', 'Акция', 9900, '[\"single\"]', NULL)",
        "INSERT INTO matrices (id, user_id, birth, sex, title) VALUES (5, 1, '1993-03-31', 'm', NULL), "
        "(7, 1, '1994-12-28', 'f', 'Вика'), (9, 2, '1990-05-05', 'f', NULL), (11, 3, '1985-01-01', 'm', NULL)",
    ]
    for sql in rows:
        con.execute(sql)
    payments = [
        # оплачен и привязан к дате 5
        (1, 1, SINGLE, 25000, 5, "2026-09-01 10:00:00", "2026-09-01 10:01:00", None, "p1", "tbank", "CONFIRMED", "a-1"),
        # брошенная попытка той же даты
        (2, 1, SINGLE, 25000, 5, "2026-09-01 09:00:00", None, None, "p2", "tbank", "REJECTED", "a-2"),
        # возвращён
        (3, 2, SINGLE, 25000, 9, "2026-09-02 10:00:00", "2026-09-02 10:01:00", "2026-09-03 10:00:00", "p3", "tbank", "REFUNDED", "a-3"),
        # подписка
        (4, 3, MONTH, 24000, None, "2026-09-04 10:00:00", "2026-09-04 10:01:00", None, "p4", "mock", "CONFIRMED", "a-4"),
    ]
    for p in payments:
        values = [p[0], p[1], json.dumps(p[2], ensure_ascii=False), p[3], p[4], p[5], p[6], p[7], p[8]]
        if legacy_columns:
            con.execute("INSERT INTO payments (id, user_id, tariff_body, amount, matrix_id, created_at, "
                        "paid_at, refunded_at, external_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", values)
        else:
            con.execute("INSERT INTO payments (id, user_id, tariff_body, amount, matrix_id, created_at, "
                        "paid_at, refunded_at, external_id, provider, status, order_id) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", values + [p[9], p[10], p[11]])
    con.executemany(
        "INSERT INTO entitlements (id, user_id, payment_id, scope, matrix_id, starts_at, expires_at, "
        "revoked_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [(1, 1, 1, '["single"]', 5, "2026-09-01 10:01:00", None, None, None),
         (2, 2, 3, '["single"]', 9, "2026-09-02 10:01:00", None, "2026-09-03 10:00:00", None),
         (3, 3, 4, '["single", "matrix", "all"]', None, "2026-09-04 10:01:00", "2099-12-01 10:01:00", None, None),
         # выдана админом без денег
         (4, 1, None, '["single"]', 7, "2026-09-05 10:00:00", None, None, "выдана админом"),
         # разовая без даты: куплена до правила о привязке
         (5, 2, None, '["single"]', None, "2026-09-06 10:00:00", None, None, None)])
    report_jobs = "INSERT INTO report_jobs (id, user_id, matrix_id, status, object_key, size_bytes, created_at"
    if legacy_columns:
        con.execute(report_jobs + ") VALUES (1, 1, 5, 'done', 'v6/1/5/ru/1.pdf', 1000, '2026-09-01 10:02:00')")
    else:
        con.execute(report_jobs + ", locale) VALUES (1, 1, 5, 'done', 'v6/1/5/ru/1.pdf', 1000, '2026-09-01 10:02:00', 'en')")
    con.commit()
    con.close()


@pytest.fixture
def base(tmp_path, monkeypatch):
    def make(**kwargs):
        path = tmp_path / "live.db"
        old_base(path, **kwargs)
        engine = create_engine(f"sqlite+pysqlite:///{path}")
        maker = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        monkeypatch.setattr(schema, "engine", engine)
        monkeypatch.setattr(schema, "SessionLocal", maker)
        monkeypatch.setattr(errors, "SessionLocal", maker)
        return engine, maker
    yield make


@pytest.mark.parametrize("legacy_columns", [False, True])
def test_live_base_moves_to_products_without_losing_anything(base, legacy_columns):
    engine, maker = base(legacy_columns=legacy_columns)
    schema.ensure()

    tables = set(inspect(engine).get_table_names())
    assert {"readings", "offers", "purchases", "schema_migrations"} <= tables
    assert not {"matrices", "tariffs"} & tables
    with engine.connect() as conn:
        indexes = dict(conn.exec_driver_sql(
            "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'entitlements'").all())
    assert "purchase_id IS NOT NULL" in indexes["ux_entitlement_active_reading"]
    assert "purchase_id IS NULL" in indexes["ux_entitlement_granted_reading"]

    with maker() as db:
        readings = {r.id: r for r in db.query(Reading)}
        assert sorted(readings) == [5, 7, 9, 11], "номера разборов — номера прежних дат"
        assert readings[5].product == "personal"
        assert readings[5].data() == {"birth": "1993-03-31", "sex": "m"}
        assert readings[5].subject_key == "1993-03-31|m"
        assert readings[7].title == "Вика" and readings[7].label() == "Вика"

        offers = {o.id: o for o in db.query(Offer)}
        assert offers["single"].product_list() == ["personal"] and offers["single"].per_reading
        assert offers["single"].public and offers["single"].price == 39000
        assert offers["month"].product_list() == ["*"] and not offers["month"].per_reading
        assert offers["month"].store_unlimited and offers["month"].public, "подписка выходит на витрину"
        assert offers["month"].price == 59000, "миграция 006: подписка 590 ₽"
        assert offers["month"].name == "Подписка на 3 месяца", "миграция 004: новое имя подписки"
        assert offers["promo"].product_list() == ["personal"] and not offers["promo"].public
        assert offers["pair"].product_list() == ["pair"], "новое предложение досеяно"
        assert offers["pair"].price == 39000

        purchases = {p.id: p for p in db.query(Purchase)}
        assert sorted(purchases) == [1, 2, 3, 4], "номера заказов — номера прежних платежей"
        assert purchases[1].reading_id == 5 and purchases[1].state() == "paid"
        assert purchases[1].amount == purchases[1].body()["price"] == 25000
        assert purchases[1].body()["products"] == ["personal"] and purchases[1].body()["site_origin"]
        assert purchases[2].state() == ("failed" if not legacy_columns else "new")
        assert purchases[3].state() == "refunded"
        assert purchases[4].reading_id is None and purchases[4].body()["products"] == ["*"]
        assert purchases[4].amount == 24000 and purchases[4].body()["price"] == 24000, "история цен не переписана"

        payments = {p.id: p for p in db.query(Payment)}
        assert {p.purchase_id for p in payments.values()} == {1, 2, 3, 4}
        assert payments[1].external_id == "p1" and payments[1].body()["id"] == "single"

        rights = {r.id: r for r in db.query(Entitlement)}
        assert rights[1].reading_id == 5 and rights[1].purchase_id == 1 and rights[1].per_reading
        assert rights[3].product_list() == ["*"] and rights[3].store_unlimited and not rights[3].per_reading
        assert rights[4].purchase_id is None and rights[4].note == "выдана админом"
        assert rights[5].reading_id is None and rights[5].per_reading

        job = db.query(ReportJob).one()
        assert job.reading_id == 5 and job.object_key == "v6/1/5/ru/1.pdf"

        # доступ после миграции тот же, что был до неё
        users = {u.id: u for u in db.query(User)}
        assert access.can_open(db, users[1], readings[5]), "купленная дата открыта"
        assert access.can_open(db, users[1], readings[7]), "выданная админом открыта"
        assert not access.can_open(db, users[2], readings[9]), "возвращённая закрыта"
        assert access.can_open(db, users[3], readings[11]), "подписка открывает любую дату"
        assert access.reading_state(access.active_rights(db, users[1]), readings[5])["access"] == "forever"
        assert access.reading_state(access.active_rights(db, users[1]), readings[7])["access"] == "granted"
        assert access.bind_unbound(db, users[2], readings[9]), "разовое право без даты по-прежнему привязывается"

    with engine.connect() as conn:
        assert conn.exec_driver_sql("PRAGMA foreign_key_check").fetchall() == []
        assert conn.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
    engine.dispose()


def test_migration_runs_once(base, capsys):
    engine, maker = base()
    schema.ensure()
    capsys.readouterr()
    schema.ensure()
    assert "миграция" not in capsys.readouterr().out, "повторный ensure прогнал миграцию снова"
    with maker() as db:
        assert db.query(Reading).count() == 4
    engine.dispose()


def test_price_increase_on_existing_products_base(base, monkeypatch):
    engine, maker = base()
    with monkeypatch.context() as prior:
        prior.setattr(schema, "MIGRATIONS", [m for m in schema.MIGRATIONS if m[0] < "006"])
        schema.ensure()
    with engine.begin() as conn:
        conn.exec_driver_sql("UPDATE offers SET price = 25000 WHERE id IN ('single', 'pair')")
        before = conn.exec_driver_sql("SELECT * FROM purchases ORDER BY id").all()
        payments_before = conn.exec_driver_sql("SELECT * FROM payments ORDER BY id").all()
    schema.ensure()
    with maker() as db:
        prices = {o.id: o.price for o in db.query(Offer)}
        assert {key: prices[key] for key in ("single", "pair", "month")} == {
            "single": 39000, "pair": 39000, "month": 59000,
        }
        assert db.get(Offer, "month").period_days == 90
    with engine.begin() as conn:
        assert conn.exec_driver_sql("SELECT * FROM purchases ORDER BY id").all() == before
        assert conn.exec_driver_sql("SELECT * FROM payments ORDER BY id").all() == payments_before
        # Следующий запуск не перезаписывает последующее изменение цены владельцем.
        conn.exec_driver_sql("UPDATE offers SET price = 41000 WHERE id = 'single'")
    schema.ensure()
    with maker() as db:
        assert db.get(Offer, "single").price == 41000
    engine.dispose()


def test_failed_migration_leaves_the_old_base_untouched(base, monkeypatch):
    engine, _maker = base()

    def broken(cur):
        schema.migrate_products(cur)
        raise RuntimeError("сбой посередине")

    monkeypatch.setattr(schema, "MIGRATIONS", [("001_products", broken)])
    with pytest.raises(RuntimeError, match="сбой посередине"):
        schema.ensure()
    tables = set(inspect(engine).get_table_names())
    assert {"matrices", "tariffs", "payments"} <= tables and "readings" not in tables
    with engine.connect() as conn:
        assert conn.exec_driver_sql("SELECT COUNT(*) FROM payments").scalar() == 4
        assert conn.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
    engine.dispose()


def test_empty_base_is_created_in_the_final_shape(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'new.db'}")
    maker = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    monkeypatch.setattr(schema, "engine", engine)
    monkeypatch.setattr(schema, "SessionLocal", maker)
    monkeypatch.setattr(errors, "SessionLocal", maker)
    schema.ensure()
    with engine.connect() as conn:
        applied = conn.exec_driver_sql("SELECT id FROM schema_migrations").scalars().all()
    assert applied == ["001_products", "002_subscription_price", "003_granted_beside_bought",
                       "004_subscription_rename", "005_subscription_price_390", "006_prices_390_590", "007_unique_purchase_right", "008_static_pair_chakras", "009_work_task_identity"], \
        "новая база не должна потом мигрировать сама себя"
    with maker() as db:
        assert {o.id: o.price for o in db.query(Offer)} == {"single": 39000, "month": 59000, "pair": 39000}
    engine.dispose()


def test_purchase_right_migration_preserves_history_and_blocks_duplicates(base, monkeypatch):
    import pytest
    from sqlalchemy.exc import IntegrityError
    engine, maker = base()
    with monkeypatch.context() as prior:
        prior.setattr(schema, 'MIGRATIONS', [m for m in schema.MIGRATIONS if m[0] < '007'])
        schema.ensure()
    with engine.begin() as conn:
        conn.exec_driver_sql('DROP INDEX IF EXISTS ux_entitlement_active_purchase')
        source = conn.exec_driver_sql('SELECT id FROM entitlements WHERE purchase_id IS NOT NULL AND reading_id IS NULL AND revoked_at IS NULL LIMIT 1').scalar_one()
        cols = 'user_id,purchase_id,products,per_reading,store_unlimited,reading_id,starts_at,expires_at,revoked_at,note'
        conn.exec_driver_sql(f'INSERT INTO entitlements ({cols}) SELECT {cols} FROM entitlements WHERE id=?', (source,))
        before = conn.exec_driver_sql('SELECT COUNT(*) FROM entitlements').scalar_one()
    schema.ensure()
    schema.ensure()
    with engine.begin() as conn:
        assert conn.exec_driver_sql('SELECT COUNT(*) FROM entitlements').scalar_one() == before
        assert conn.exec_driver_sql('SELECT COUNT(*) FROM entitlements WHERE purchase_id=(SELECT purchase_id FROM entitlements WHERE id=?) AND revoked_at IS NULL', (source,)).scalar_one() == 1
        assert conn.exec_driver_sql('SELECT revoked_at FROM entitlements WHERE id=?', (source,)).scalar_one() is None
        with pytest.raises(IntegrityError):
            conn.exec_driver_sql(f'INSERT INTO entitlements ({cols}) SELECT {cols} FROM entitlements WHERE id=?', (source,))


def test_static_chakras_remove_only_the_retired_queue_and_tables(db_engine):
    from app.models import WorkTask
    with Session(db_engine) as db:
        db.add_all([WorkTask(kind="pair_chakras", status="queued"),
                    WorkTask(kind="pair_chakras", status="done"), WorkTask(kind="test")])
        db.commit()
    with db_engine.begin() as conn:
        conn.exec_driver_sql("CREATE TABLE pair_chakra_waits (id INTEGER PRIMARY KEY)")
        conn.exec_driver_sql("CREATE TABLE pair_chakra_texts (id INTEGER PRIMARY KEY, body TEXT)")
    raw = db_engine.raw_connection()
    try:
        cur = raw.cursor()
        assert schema.static_pair_chakras(cur)["старые задачи чакр удалены"] == 2
        assert schema.static_pair_chakras(cur)["старые задачи чакр удалены"] == 0
        raw.commit()
    finally:
        raw.close()
    assert not {"pair_chakra_waits", "pair_chakra_texts"} & set(inspect(db_engine).get_table_names())
    with Session(db_engine) as db:
        assert [task.kind for task in db.query(WorkTask)] == ["test"]


def test_work_task_migration_preserves_tasks_and_prevents_id_reuse(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'tasks.db'}")
    maker = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    monkeypatch.setattr(schema, "engine", engine)
    monkeypatch.setattr(schema, "SessionLocal", maker)
    monkeypatch.setattr(errors, "SessionLocal", maker)
    with monkeypatch.context() as prior:
        prior.setattr(schema, "MIGRATIONS", [m for m in schema.MIGRATIONS if m[0] < "009"])
        schema.ensure()
    # Recreate the exact preceding table: INTEGER PRIMARY KEY without AUTOINCREMENT.
    with engine.begin() as conn:
        conn.exec_driver_sql("DROP TABLE work_tasks")
        conn.exec_driver_sql(schema._table_ddl("work_tasks").replace(" AUTOINCREMENT", ""))
        for ddl in schema._index_ddl("work_tasks"):
            conn.exec_driver_sql(ddl)
    with maker() as db:
        row = WorkTask(id=42, kind="test", status="signalled", attempts=2,
                       params='{"request": "keep"}', error="keep error")
        db.add(row)
        db.commit()
        original = row.item()
    schema.ensure()
    schema.ensure()  # The migration is applied only once.
    with maker() as db:
        row = db.get(WorkTask, 42)
        assert row.item() == original
        db.delete(row)
        db.commit()
    engine.dispose()  # Sequence survives deletion of the last row and a new connection.
    with maker() as db:
        row = WorkTask(kind="test")
        db.add(row)
        db.commit()
        assert row.id > 42
    with engine.connect() as conn:
        assert {i["name"] for i in inspect(engine).get_indexes("work_tasks")} == {
            i.name for i in WorkTask.__table__.indexes}
        assert conn.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    engine.dispose()
