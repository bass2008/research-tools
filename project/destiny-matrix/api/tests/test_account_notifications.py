"""API contracts for operations, business events and independent recipient deliveries."""
import datetime as dt
import jwt
import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import sessionmaker
from app import account_operations, audit, mail, notifications, access, offers, payments, sites
from app.config import settings
from app.models import User, AccountOperation, Notification, NotificationDelivery as Delivery, Reading, Entitlement, Payment, Purchase, utcnow
from app.security import create_token, create_reset_token, create_operation_token
from app.routers.payments import apply

@pytest.fixture(autouse=True)
def transport(monkeypatch, db_engine):
    account_operations._rates.clear()
    monkeypatch.setattr(audit, 'SessionLocal', sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False))
    sent = []
    monkeypatch.setattr(mail, 'send', lambda to, subject, body: sent.append((to, subject, body)) or True)
    yield sent
    account_operations._rates.clear()

def user(db, email='user@example.ru'):
    db.expire_all()
    return db.scalar(select(User).where(User.email == email))

def token_for(db, purpose):
    op = db.scalar(select(AccountOperation).order_by(AccountOperation.id.desc()))
    return create_operation_token(op.id, op.user_id, purpose, op.expires_at.replace(tzinfo=dt.timezone.utc))

def confirm(client, token, kind='change'):
    return client.post(f'/api/auth/email/{kind}/confirm', json={'token': token})

def test_verify_explicit_optional_and_not_notification(client, auth, db, transport):
    h = auth()
    assert client.get('/api/auth/me', headers=h).json()['user']['email_verified_at'] is None
    r = client.post('/api/auth/email/verification/request', headers=h)
    assert r.status_code == 200, r.text
    token = token_for(db, 'verify_current')
    assert user(db).email_verified_at is None
    assert client.get('/api/auth/email/verification/confirm', params={'token': token}).status_code == 405
    assert confirm(client, token, 'change').status_code == 400
    assert confirm(client, token, 'verification').status_code == 200
    assert user(db).email_verified_at
    assert confirm(client, token, 'verification').status_code == 400
    assert client.get('/api/auth/me', headers=h).status_code == 200
    assert db.scalar(select(func.count(Notification.id))) == 0
    assert '#token=' in transport[-1][2]

@pytest.mark.parametrize('verified,first', [(False, 'verify_new'), (True, 'approve_old'), (True, 'verify_new')])
def test_email_change_preserves_id_revokes_sessions_and_reset(client, auth, db, verified, first):
    h = auth(); u = user(db); uid = u.id
    if verified:
        u.email_verified_at = utcnow(); db.commit()
    reset = create_reset_token(u.id, u.password_hash, u.email, u.auth_version)
    r = client.post('/api/auth/email/change/request', headers=h, json={'new_email': 'new@example.ru', 'current_password': 'secret123'})
    assert r.status_code == 200, r.text
    assert user(db).email == 'user@example.ru'
    one = token_for(db, first)
    two = token_for(db, 'verify_new' if first == 'approve_old' else 'approve_old')
    r = confirm(client, one)
    assert r.status_code == 200, r.text
    if verified:
        assert r.json()['changed'] is False
        assert user(db).email == 'user@example.ru'
        r = confirm(client, two)
    assert r.json()['changed'] is True
    u = user(db, 'new@example.ru')
    assert u.id == uid and u.email_verified_at and u.auth_version == 1
    assert client.get('/api/auth/me', headers=h).status_code == 401
    assert client.post('/api/auth/reset/apply', json={'token': reset, 'password': 'another'}).status_code == 400
    assert client.post('/api/auth/login', json={'email': 'new@example.ru', 'password': 'secret123'}).status_code == 200
    assert confirm(client, one).status_code == 400
    assert db.scalar(select(func.count(Notification.id))) == 0

def test_password_change_revokes_other_sessions_and_pending_operation(client, auth, db):
    h = auth()
    assert client.post('/api/auth/email/verification/request', headers=h).status_code == 200
    token = token_for(db, 'verify_current')
    assert client.post('/api/auth/password/change', headers=h, json={'current_password': 'wrong', 'new_password': 'secret456'}).status_code == 400
    r = client.post('/api/auth/password/change', headers=h, json={'current_password': 'secret123', 'new_password': 'secret456'})
    assert r.status_code == 200, r.text
    assert client.get('/api/auth/me', headers=h).status_code == 401
    assert client.get('/api/auth/me', headers={'Authorization': 'Bearer '+r.json()['token']}).status_code == 200
    assert confirm(client, token, 'verification').status_code == 400
    assert user(db).email_verified_at is None
    assert db.scalar(select(func.count(Notification.id))) == 0

def test_reset_verifies_email_and_legacy_session_version_zero(client, auth, db):
    h = auth(); u = user(db)
    raw = jwt.decode(h['Authorization'].split()[1], settings.jwt_secret, algorithms=[settings.jwt_algorithm]); raw.pop('ver')
    old = {'Authorization': 'Bearer '+jwt.encode(raw, settings.jwt_secret, algorithm=settings.jwt_algorithm)}
    assert client.get('/api/auth/me', headers=old).status_code == 200
    reset = create_reset_token(u.id, u.password_hash, u.email, 0)
    r = client.post('/api/auth/reset/apply', json={'token': reset, 'password': 'secret456'})
    assert r.status_code == 200, r.text
    assert user(db).email_verified_at
    assert client.get('/api/auth/me', headers=old).status_code == 401

def test_superseding_expired_wrong_purpose_taken_email(client, auth, db):
    h = auth(); payload = {'new_email': 'next@example.ru', 'current_password': 'secret123'}
    assert client.post('/api/auth/email/change/request', headers=h, json=payload).status_code == 200
    old = token_for(db, 'verify_new')
    assert client.post('/api/auth/email/change/request', headers=h, json=payload).status_code == 429
    op = db.scalar(select(AccountOperation)); op.created_at -= dt.timedelta(minutes=2); db.commit()
    account_operations._rates.clear(); payload['new_email'] = 'other@example.ru'
    assert client.post('/api/auth/email/change/request', headers=h, json=payload).status_code == 200
    assert confirm(client, old).status_code == 400
    assert confirm(client, token_for(db, 'verify_current')).status_code == 400
    valid = token_for(db, 'verify_new'); auth('other@example.ru')
    assert confirm(client, valid).status_code == 409
    assert user(db).email == 'user@example.ru'
    op = db.scalar(select(AccountOperation).order_by(AccountOperation.id.desc())); op.expires_at = utcnow()-dt.timedelta(seconds=1); db.commit()
    assert confirm(client, valid).status_code == 400

def test_typo_retry_fits_the_burst_and_the_hourly_cap_still_holds(client, auth):
    h = auth(); url = '/api/auth/email/change/request'
    typo = {'new_email': 'next@example.ru', 'current_password': 'secret12'}
    assert client.post(url, headers=h, json=typo).status_code == 400
    assert client.post(url, headers=h, json={**typo, 'current_password': 'secret123'}).status_code == 200
    assert [client.post(url, headers=h, json=typo).status_code for _ in range(4)] == [400, 400, 400, 429]

def test_ghost_and_admin_account_protection(client, auth, db):
    auth(); u = user(db); ghost = {'Authorization': 'Bearer '+create_token(u.id, u.password_hash, ghost=True)}
    for path, payload in [('password/change', {'current_password': 'secret123', 'new_password': 'secret456'}), ('email/change/request', {'current_password': 'secret123', 'new_email': 'next@example.ru'}), ('email/verification/request', {})]:
        assert client.post('/api/auth/'+path, headers=ghost, json=payload).status_code == 403
    admin = auth(settings.admins[0])
    assert client.post('/api/auth/email/change/request', headers=admin, json={'current_password': 'secret123', 'new_email': 'next@example.ru'}).status_code == 403
    h = client.post('/api/auth/login', json={'email': u.email, 'password': 'secret123'}).json()['token']; account_operations._rates.clear()
    assert client.post('/api/auth/email/change/request', headers={'Authorization': 'Bearer '+h}, json={'current_password': 'secret123', 'new_email': settings.admins[0]}).status_code == 403

def test_pagination_isolation_read_boundary_and_admin_filters(client, auth, db):
    first, second, admin = auth(), auth('other@example.ru'), auth(settings.admins[0])
    a, b = user(db), user(db, 'other@example.ru')
    for i in range(23): notifications.emit(db, 'subscription_active', f'test:{i}', {**notifications.context(), 'until': '2026-12-01'}, [a.id, b.id])
    db.commit()
    page = client.get('/api/notifications?page=2&page_size=10', headers=first).json()
    assert len(page['items']) == 10 and page['total'] == 23 and page['unread_count'] == 23
    boundary = page['through_id']; own_id = page['items'][0]['delivery_id']
    assert client.post(f'/api/notifications/{own_id}/read', headers=second).status_code == 404
    assert client.post(f'/api/notifications/{own_id}/read', headers=first).status_code == 200
    assert client.post(f'/api/notifications/{own_id}/read', headers=first).json()['read_at']
    notifications.emit(db, 'subscription_active', 'new', {**notifications.context(), 'until': '2027-01-01'}, [a.id]); db.commit()
    assert client.post('/api/notifications/read-all', headers=first, json={'through_id': boundary}).status_code == 200
    assert client.get('/api/notifications', headers=first).json()['unread_count'] == 1
    assert client.get('/api/notifications', headers=second).json()['unread_count'] == 23
    filtered = client.get(f'/api/admin/notifications?user_id={a.id}&read=true&page_size=100', headers=admin)
    assert filtered.status_code == 200 and filtered.json()['total'] == 23
    assert client.get('/api/notifications', headers=second).json()['unread_count'] == 23
    assert client.get('/api/admin/notifications', headers=second).status_code == 403
    assert client.get('/api/notifications?page=0', headers=first).status_code == 422
    assert client.get('/api/admin/notifications?page_size=101', headers=admin).status_code == 422
    assert client.get('/api/notifications?page=999', headers=first).json()['items'] == []

def test_payment_events_once_and_independent_admin_recipients(client, auth, db, monkeypatch, transport):
    monkeypatch.setattr(settings, 'admin_emails', 'one@example.ru,two@example.ru')
    admins = [auth('one@example.ru'), auth('two@example.ru')]
    r = client.post('/api/payments/mock', json={'tariff': 'month', 'email': 'buyer@example.ru'})
    assert r.status_code == 200, r.text
    buyer = {'Authorization': 'Bearer '+r.json()['token']}
    assert client.get('/api/notifications', headers=buyer).json()['items'][0]['type'] == 'subscription_active'
    # Payment notices live only in the admin panel: one notification, an independent delivery per admin.
    for h in admins:
        assert client.get('/api/notifications', headers=h).json()['unread_count'] == 0
    rows = client.get('/api/admin/notifications?type=admin_payment_succeeded', headers=admins[0]).json()['items']
    assert len(rows) == 2 and rows[0]['notification_id'] == rows[1]['notification_id']
    assert {r['user']['email'] for r in rows} == {'one@example.ru', 'two@example.ru'}
    assert client.post(f"/api/notifications/{rows[0]['delivery_id']}/read", headers=admins[0]).status_code == 404
    count = len(transport); payment = db.scalar(select(Payment))
    apply(db, payment, payments.Update(payment.external_id, payment.order_id, payments.Outcome.PAID, 'CONFIRMED'))
    assert len(transport) == count and db.scalar(select(func.count(Notification.id))) == 2
    assert all(d.email_status == 'sent' for d in db.scalars(select(Delivery)))
    monkeypatch.setattr(settings, 'admin_emails', 'two@example.ru')
    assert client.get('/api/notifications', headers=admins[0]).json()['total'] == 0
    assert client.get('/api/admin/notifications', headers=admins[0]).status_code == 403


def test_grant_removal_preserves_rights_and_reuses_reading(client, auth, db):
    h, admin = auth(), auth(settings.admins[0]); uid = user(db).id
    url = f'/api/admin/users/{uid}/readings'; payload = {'product': 'personal', 'inputs': {'birth': '1996-04-01', 'sex': 'f'}}
    r = client.post(url, json=payload, headers=admin)
    assert r.status_code == 200, r.text
    rid = r.json()['id']
    assert client.post(url, json=payload, headers=admin).json()['granted_now'] is False
    assert client.get('/api/notifications', headers=h).json()['total'] == 1
    assert client.get(f'/api/readings/{rid}', headers=h).json()['can_delete'] is True
    assert client.delete(f'/api/readings/{rid}', headers=h).status_code == 204
    assert client.get('/api/readings', headers=h).json()['items'] == []
    assert db.scalar(select(Entitlement).where(Entitlement.reading_id == rid)) is not None
    again = client.post('/api/readings', headers=h, json=payload)
    assert again.status_code == 200 and again.json()['id'] == rid and again.json()['unlocked'] is True
    assert client.get('/api/notifications', headers=h).json()['total'] == 1

def test_paid_cannot_be_removed_even_after_refund(client, paid, db):
    h = paid('single', birth='1996-04-01'); row = db.scalar(select(Reading)); row.saved_via = 'subscription'; db.commit()
    assert client.delete(f'/api/readings/{row.id}', headers=h).status_code == 409
    payment = db.scalar(select(Payment))
    apply(db, payment, payments.Update(payment.external_id, payment.order_id, payments.Outcome.REFUNDED, 'REFUNDED'))
    assert client.get(f'/api/readings/{row.id}', headers=h).json()['can_delete'] is False
    assert client.delete(f'/api/readings/{row.id}', headers=h).status_code == 409

def test_legacy_subscription_purchase_does_not_make_reading_individually_paid(client, paid, db):
    h = paid('month')
    result = client.post('/api/readings', headers=h, json={
        'product': 'personal', 'inputs': {'birth': '1996-04-01', 'sex': 'f'}})
    assert result.status_code == 200
    rid = result.json()['id']
    # Migration preserves the matrix attached to old subscription payments.
    purchase = db.scalar(select(Purchase))
    purchase.reading_id = rid
    db.commit()
    assert client.get(f'/api/readings/{rid}', headers=h).json()['can_delete'] is True
    assert client.delete(f'/api/readings/{rid}', headers=h).status_code == 204
    db.expire_all()
    assert db.get(Purchase, purchase.id).paid_at is not None
    assert client.get('/api/auth/me', headers=h).json()['unlimited'] is True
    payment = db.scalar(select(Payment))
    assert client.post('/api/payments/sync', headers=h, json={'order_id': payment.order_id}).status_code == 200
    assert client.get('/api/readings', headers=h).json()['items'] == []


def test_expiration_overlaps_catchup_and_failed_email(client, auth, db, monkeypatch):
    h, admin = auth(), auth(settings.admins[0]); uid = user(db).id
    assert client.post(f'/api/admin/users/{uid}/subscription', headers=admin).status_code == 200
    right = db.scalar(select(Entitlement).where(Entitlement.user_id == uid))
    right.starts_at = utcnow()-dt.timedelta(days=15); right.expires_at = utcnow()-dt.timedelta(days=3); db.flush()
    second = access.grant(db, db.get(User, uid), offers.get(db, 'month').body(), now=utcnow()-dt.timedelta(days=7))
    second.expires_at = utcnow()-dt.timedelta(days=2); notifications.grant_event(db, db.get(User, uid), second); db.commit()
    monkeypatch.setattr(settings, 'notification_check_secret', 'only-service')
    monkeypatch.setattr(settings, 'notification_check_since', (utcnow()-dt.timedelta(days=8)).isoformat())
    monkeypatch.setattr(mail, 'send', lambda *a, **k: False)
    assert client.post('/api/internal/notifications/check', headers=h).status_code == 403
    r = client.post('/api/internal/notifications/check', headers={'Authorization': 'Bearer only-service'})
    assert r.status_code == 200 and r.json() == {'created': 1, 'email_errors': 1}, r.text
    assert client.post('/api/internal/notifications/check', headers={'Authorization': 'Bearer only-service'}).json()['created'] == 0
    assert sum(n['type'] == 'subscription_expired' for n in client.get('/api/notifications', headers=h).json()['items']) == 1
    assert db.scalar(select(Delivery).join(Notification).where(Notification.type == 'subscription_expired')).email_status == 'failed'


def test_two_confirmations_race_complete_once(client, auth, db, transport):
    from concurrent.futures import ThreadPoolExecutor
    h = auth(); u = user(db); u.email_verified_at = utcnow(); db.commit()
    assert client.post('/api/auth/email/change/request', headers=h,
        json={'new_email': 'parallel@example.ru', 'current_password': 'secret123'}).status_code == 200
    tokens = [token_for(db, purpose) for purpose in ('verify_new', 'approve_old')]
    before = len(transport)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda t: confirm(client, t), tokens))
    assert [r.status_code for r in responses] == [200, 200]
    assert sum(r.json()['changed'] for r in responses) == 1
    assert len(transport) == before + 2
    assert user(db, 'parallel@example.ru').auth_version == 1


def test_saved_subscription_origin_survives_expiry_and_is_not_a_business_event(client, paid, db):
    h = paid('month')
    r = client.post('/api/readings', headers=h, json={'product': 'pair', 'inputs': {
        'a': {'birth': '1993-03-31', 'sex': 'm'}, 'b': {'birth': '1994-12-24', 'sex': 'f'}}})
    assert r.status_code == 200 and r.json()['can_delete'], r.text
    rid = r.json()['id']
    count = db.scalar(select(func.count(Notification.id)))
    right = db.scalar(select(Entitlement)); right.expires_at = utcnow()-dt.timedelta(days=1); db.commit()
    assert client.delete(f'/api/readings/{rid}', headers=h).status_code == 204
    assert db.scalar(select(func.count(Notification.id))) == count


def test_expiration_parallel_checks_current_renewal_and_start_boundary(client, auth, db, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    h, admin = auth(), auth(settings.admins[0]); uid = user(db).id
    client.post(f'/api/admin/users/{uid}/subscription', headers=admin)
    right = db.scalar(select(Entitlement)); right.starts_at=utcnow()-dt.timedelta(days=10); right.expires_at=utcnow()-dt.timedelta(days=2); db.commit()
    monkeypatch.setattr(settings, 'notification_check_secret', 'service')
    monkeypatch.setattr(settings, 'notification_check_since', (utcnow()-dt.timedelta(days=1)).isoformat())
    def check(_=None): return client.post('/api/internal/notifications/check', headers={'Authorization': 'Bearer service'})
    assert check().json()['created'] == 0
    monkeypatch.setattr(settings, 'notification_check_since', (utcnow()-dt.timedelta(days=3)).isoformat())
    with ThreadPoolExecutor(max_workers=2) as pool: results = list(pool.map(check, range(2)))
    assert sum(r.json()['created'] for r in results) == 1
    # A later active entitlement suppresses any old-end messages even if the old delivery is gone.
    new = access.grant(db, user(db), offers.get(db, 'month').body()); db.commit()
    assert check().json()['created'] == 0


def test_mail_failure_does_not_undo_paid_right_or_other_deliveries(client, auth, db, monkeypatch):
    admin = auth(settings.admins[0])
    calls = []
    def send(to, *_):
        calls.append(to)
        if to == 'fail@example.ru': raise RuntimeError('transport failed')
        return True
    monkeypatch.setattr(mail, 'send', send)
    # Welcome is not part of the purchase; use an existing buyer so its transport cannot mask the event.
    monkeypatch.setattr(mail, 'welcome', lambda *_: True)
    r = client.post('/api/payments/mock', json={'tariff': 'single', 'email': 'fail@example.ru', 'birth': '1996-04-01'})
    assert r.status_code == 200, r.text
    assert db.scalar(select(Payment)).paid_at and db.scalar(select(Entitlement))
    rows = db.scalars(select(Delivery).order_by(Delivery.id)).all()
    assert [d.email_status for d in rows] == ['failed', 'sent']
    assert settings.admins[0] in calls


def test_ghost_cannot_mark_read_or_confirm_even_with_valid_link(client, auth, db):
    h = auth(); u = user(db)
    ghost = {'Authorization': 'Bearer '+create_token(u.id, u.password_hash, ghost=True)}
    assert client.post('/api/auth/email/verification/request', headers=h).status_code == 200
    token = token_for(db, 'verify_current')
    assert client.post('/api/auth/email/verification/confirm', headers=ghost, json={'token': token}).status_code == 403
    did = notifications.emit(db, 'subscription_active', 'ghost', {**notifications.context(), 'until': '2027-01-01'}, [u.id])[0]; db.commit()
    assert client.post(f'/api/notifications/{did}/read', headers=ghost).status_code == 403
    assert client.post('/api/notifications/read-all', headers=ghost, json={'through_id': did}).status_code == 403
    assert client.get('/api/notifications', headers=h).json()['unread_count'] == 1


def test_completed_password_change_survives_transport_exception(client, auth, db, monkeypatch):
    h = auth()
    def fail(*a, **k): raise RuntimeError('transport error')
    monkeypatch.setattr(mail, 'send', fail)
    r = client.post('/api/auth/password/change', headers=h, json={'current_password': 'secret123', 'new_password': 'secret456'})
    assert r.status_code == 200, r.text
    assert client.post('/api/auth/login', json={'email': 'user@example.ru', 'password': 'secret456'}).status_code == 200


def test_notification_templates_localize_without_birth_dates_in_email():
    import json
    for kind in ('reading_available','subscription_active','subscription_expired',notifications.ADMIN_TYPE):
        note=Notification(type=kind, event_key='template', data=json.dumps({
            'product':'pair','title':'Pair 31 March 1993', 'reading_id':7, 'source':'admin',
            'titles':{'ru':'Пара 31 марта 1993','en':'Pair 31 March 1993'}, 'until':'2026-11-03T00:00:00Z',
            'amount':39000,'currency':'RUB','offer_name':'Compatibility','buyer_email':'test@example.org',
            'payment_id':1,'purchase_id':2,'site_origin':'https://arcana-sense.ru'}))
        for locale in ('ru','en'):
            result=notifications.render(note,locale)
            assert result['title'] and result['text'] and result['action']['href'].startswith('/')
            assert '1993' not in notifications.render(note,locale,email=True)['text']
        if kind=='reading_available':
            assert 'Пара' in notifications.render(note,'ru')['text']
            assert 'Pair' in notifications.render(note,'en')['text']
    note=Notification(type='subscription_active',event_key='forever',data='{}')
    assert notifications.render(note,'ru')['text']=='Бессрочный доступ.'


def test_old_grant_without_domain_sends_and_future_mail_domain_can_change(client, auth, db, monkeypatch, transport):
    h = auth(); u = user(db)
    right = access.grant(db, u, offers.get(db, 'month').body(), now=utcnow()-dt.timedelta(days=100))
    db.commit()
    # No activation notification and no domain metadata: a historical admin grant.
    monkeypatch.setattr(settings, 'mail_site_origin', 'https://arcana-sense.ru')
    ids = notifications.expiration_events(db, utcnow()-dt.timedelta(days=20)); db.commit()
    assert len(ids) == 1
    with sites.using_site(None):  # the expiry loop runs outside any request
        assert notifications.deliver_emails(db, ids) == 0
    assert 'https://arcana-sense.ru/ru/account' in transport[-1][2]
    assert db.get(Delivery, ids[0]).email_status == 'sent'
    # Current mail destination changes independently of stored historical event data.
    monkeypatch.setattr(settings, 'mail_site_origin', 'https://arcana-sense.com')
    next_ids = notifications.emit(db, 'subscription_active', 'migration', {
        'site_origin': 'https://retired.example', 'locale': 'ru', 'until': '2027-01-01'}, [u.id]); db.commit()
    with sites.using_site(None):
        assert notifications.deliver_emails(db, next_ids) == 0
    assert 'https://arcana-sense.com/ru/account' in transport[-1][2]
    assert 'retired.example' not in transport[-1][2]


def test_subscription_access_is_shared_across_domains(client, paid, db, monkeypatch):
    h = paid('month'); uid = db.scalar(select(User.id))
    profiles = [
        {'origin': origin, 'defaultLocale': 'ru', 'locales': ['ru','en'], 'payments': []}
        for origin in ('https://arcana-sense.ru', 'https://arcana-sense.com')]
    monkeypatch.setattr(settings, 'site_profiles', __import__('json').dumps(profiles))
    answers = [client.get('/api/auth/me', headers={**h, 'X-Arcana-Site-Origin': p['origin']}).json() for p in profiles]
    assert answers[0]['user']['id'] == answers[1]['user']['id'] == uid
    assert answers[0]['access'] == answers[1]['access']
    assert answers[0]['unlimited'] is True


def test_daily_check_covers_recent_window_and_runs_at_moscow_noon(client, auth, db):
    h, admin = auth(), auth(settings.admins[0]); uid = user(db).id
    client.post(f'/api/admin/users/{uid}/subscription', headers=admin)
    right = db.scalar(select(Entitlement)); right.starts_at = utcnow()-dt.timedelta(days=40)
    right.expires_at = utcnow()-dt.timedelta(days=5); db.commit()
    assert notifications.check_expirations(db)['created'] == 0
    right.expires_at = utcnow()-dt.timedelta(days=2); db.commit()
    assert notifications.check_expirations(db)['created'] == 1
    assert notifications.check_expirations(db)['created'] == 0
    assert notifications.seconds_to_next_check(dt.datetime(2026, 11, 1, 8, 59, tzinfo=dt.timezone.utc)) == 60
    assert notifications.seconds_to_next_check(dt.datetime(2026, 11, 1, 9, 0, tzinfo=dt.timezone.utc)) == 86400
