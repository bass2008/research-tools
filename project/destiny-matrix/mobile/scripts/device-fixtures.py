"""Create isolated, non-admin fixtures on the local mock server for Maestro.
Writes test credentials/tokens only to the ignored output file, never stdout.
"""
import argparse
import json
import time
import urllib.request
from pathlib import Path

BASE = 'http://127.0.0.1:3000'
PASSWORD = 'Mobile-fixture-8673'

def api(path, body=None, token=None):
    headers = {'Content-Type': 'application/json', 'Accept-Language': 'ru'}
    if token:
        headers['X-Arcana-Session'] = token
    req = urllib.request.Request(BASE + '/api' + path, data=None if body is None else json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(req, timeout=90) as result:
        return json.load(result)

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['prepare', 'expire', 'refund', 'reset', 'invalidate'])
parser.add_argument('file', type=Path)
args = parser.parse_args()
assert api('/mobile/billing/status')['provider'] == 'mock', 'Requires the local mock billing provider'
if args.action == 'prepare':
    tag = str(time.time_ns())
    def account(label):
        email = f'mobile-{label}-{tag}@example.org'
        return {'email': email, **api('/mobile/auth/register', {'email': email, 'password': PASSWORD})}
    owner, subscriber, outsider = (account(x) for x in ['owner', 'subscriber', 'outsider'])
    def reading(user, birth):
        return api('/readings', {'product': 'personal', 'inputs': {'birth': birth, 'sex': 'f'}, 'title': 'Mobile fixture ' + birth}, user['token'])['id']
    def buy(user, product, reading_id=None, inputs=None):
        body = {'product_id': product}
        if reading_id is not None:
            body['reading_id'] = reading_id
        if inputs is not None:
            body['inputs'] = inputs
        order = api('/mobile/billing/orders', body, user['token'])
        return api('/mobile/billing/mock', {'order_id': order['order_id'], 'state': 'purchased'}, user['token'])
    receipt = buy(owner, 'single', inputs={'birth': '1987-06-14', 'sex': 'f'})
    paid = receipt['reading_id']
    second_receipt = buy(owner, 'single', inputs={'birth': '1990-04-03', 'sex': 'f'})
    second = second_receipt['reading_id']
    pair_receipt = buy(owner, 'pair', inputs={'a': {'birth': '1987-06-14'}, 'b': {'birth': '1999-05-27'}})
    pair = pair_receipt['reading_id']
    locked = reading(owner, '1989-09-21')
    sub_receipt = buy(subscriber, 'month')
    sub_reading = reading(subscriber, '1992-11-07')
    data = {'owner': owner, 'subscriber': subscriber, 'outsider': outsider, 'paid_id': paid, 'locked_id': locked, 'second_id': second, 'pair_id': pair,
            'receipt': receipt, 'pair_receipt': pair_receipt, 'second_receipt': second_receipt, 'sub_receipt': sub_receipt, 'sub_id': sub_reading, 'password': PASSWORD}
    args.file.parent.mkdir(parents=True, exist_ok=True)
    args.file.write_text(json.dumps(data, indent=2))
    args.file.chmod(0o600)
    print('Prepared 3 isolated accounts, two single purchases, pair and subscription.')
else:
    data = json.loads(args.file.read_text())
    user = data['subscriber'] if args.action == 'expire' else data['owner']
    if args.action in ['expire', 'refund']:
        receipt = data['sub_receipt'] if args.action == 'expire' else data['receipt']
        result = api('/mobile/billing/mock', {'order_id': receipt['order_id'], 'state': 'expired' if args.action == 'expire' else 'refunded'}, user['token'])
        assert result['access'] is False
        print('Fixture access revoked.')
    elif args.action == 'reset':
        api('/auth/reset/request', {'email': user['email']})
        print('Reset mail written by the local server; inspect the local mail log for this fixture only.')
    elif args.action == 'invalidate':
        password = user.get('password', data['password'])
        result = api('/auth/password/change', {'current_password': password, 'new_password': password + '-changed'}, user['token'])
        user['token'] = result['token']
        user['password'] = password + '-changed'
        args.file.write_text(json.dumps(data, indent=2))
        print('Fixture session invalidated.')
