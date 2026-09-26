"""Concurrent owner downloads share one render, including the cold-cache race."""
import datetime as dt
import threading
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app import printing, reports
from app.db import Base
from app.i18n import using_locale
from app.models import Entitlement, ReportJob, SavedMatrix, User
from app.routers.reports import render
from app.schemas import ReportRequest


def test_concurrent_cold_downloads_share_job(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'concurrent.db'}")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        user = User(email="concurrent@example.ru", password_hash="unused")
        db.add(user)
        db.flush()
        matrix = SavedMatrix(user_id=user.id, birth=dt.date(1993, 3, 31), sex="f")
        db.add(matrix)
        db.flush()
        db.add(Entitlement(user_id=user.id, matrix_id=matrix.id, scope='["single"]'))
        db.commit()
        uid, mid = user.id, matrix.id

    entered = threading.Event()
    release = threading.Event()
    start = threading.Barrier(2)
    calls = []
    files = {}

    def printer(url):
        calls.append(url)
        entered.set()
        assert release.wait(5)
        return b"%PDF-concurrency"

    monkeypatch.setattr(printing.settings, "browser_url", "http://browser")
    monkeypatch.setattr(printing.settings, "reports_store", "local")
    monkeypatch.setattr(printing.settings, "reports_dir", str(tmp_path))
    monkeypatch.setattr(reports, "render", printer)
    monkeypatch.setattr(reports, "upload", lambda key, pdf: files.__setitem__(key, pdf))
    monkeypatch.setattr(reports, "link", lambda key, filename=None: f"https://files/{key}")
    monkeypatch.setattr(printing, "store", lambda: SimpleNamespace(exists=lambda key: key in files))
    # Reproduce the race where neither request observed an already running DB row.
    monkeypatch.setattr(printing, "running", lambda *args: None)

    def download():
        with Session(engine) as db, using_locale("en"):
            user = db.get(User, uid)
            start.wait(5)
            return render(ReportRequest(matrix_id=mid), user, db)

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(download) for _ in range(2)]
            if not entered.wait(5):
                for future in futures:
                    if future.done():
                        future.result()
                raise AssertionError("Neither request reached the renderer")
            release.set()
            answers = [f.result(timeout=10) for f in futures]
        assert len(calls) == 1
        assert answers[0]["job_id"] == answers[1]["job_id"]
        assert sorted(answer["cached"] for answer in answers) == [False, True]
        with Session(engine) as db:
            assert len(db.scalars(select(ReportJob)).all()) == 1
        assert not printing._report_locks
    finally:
        release.set()
        engine.dispose()
