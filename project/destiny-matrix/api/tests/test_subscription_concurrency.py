from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from sqlalchemy import delete, select
from sqlalchemy.orm import sessionmaker

from app import access, mail, payments
from app.models import Entitlement, Payment
from app.routers.payments import apply


def test_concurrent_subscription_notifications(client, db, db_engine, monkeypatch):
    response = client.post('/api/payments/mock', json={'tariff': 'month', 'email': 'parallel@example.ru'})
    assert response.status_code == 200
    payment = db.scalar(select(Payment))
    payment_id, purchase_id = payment.id, payment.purchase_id
    db.execute(delete(Entitlement).where(Entitlement.purchase_id == purchase_id))
    payment.paid_at = payment.purchase.paid_at = None
    payment.status = 'NEW'
    db.commit()
    letters = []
    monkeypatch.setattr(mail, 'purchase', lambda *a, **kw: letters.append(a))
    original = access.grant
    barrier = Barrier(2)

    def grant(*args, **kwargs):
        # Both handlers have already read that no entitlement exists.
        barrier.wait(timeout=10)
        return original(*args, **kwargs)

    monkeypatch.setattr(access, 'grant', grant)
    sessions = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)

    def notify(status):
        with sessions() as session:
            row = session.get(Payment, payment_id)
            apply(session, row, payments.Update(row.external_id, row.order_id, payments.Outcome.PAID, status))

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(notify, ['AUTHORIZED', 'CONFIRMED']))
    db.expire_all()
    rights = db.scalars(select(Entitlement).where(Entitlement.purchase_id == purchase_id)).all()
    assert len(rights) == 1
    assert len(letters) == 1
    assert db.get(Payment, payment_id).paid_at is not None
    monkeypatch.setattr(access, 'grant', original)
    notify('CONFIRMED')
    with sessions() as session:
        row = session.get(Payment, payment_id)
        apply(session, row, payments.Update(row.external_id, row.order_id, payments.Outcome.REFUNDED, 'REFUNDED'))
    notify('CONFIRMED')
    db.expire_all()
    assert len(db.scalars(select(Entitlement).where(Entitlement.purchase_id == purchase_id)).all()) == 1
    assert db.get(Entitlement, rights[0].id).revoked_at is not None
    assert len(letters) == 1
