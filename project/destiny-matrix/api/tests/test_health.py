def test_health_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "db": True}


def test_health_reports_dead_db(client, db_engine):
    db_engine.dispose()
    from sqlalchemy import event

    @event.listens_for(db_engine, "connect")
    def boom(*_a, **_kw):
        raise RuntimeError("БД недоступна")

    r = client.get("/api/health")
    event.remove(db_engine, "connect", boom)
    assert r.status_code == 200
    assert r.json()["db"] is False
