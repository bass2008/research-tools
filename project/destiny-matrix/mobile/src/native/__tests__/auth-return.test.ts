import { expect, it } from '@jest/globals';
import { authHref, safeAuthReturn } from '../authReturn';
import { internalTarget } from '../navigation';

it.each([
  '/account', '/year', '/report', '/compatibility', '/purchase', '/purchase?product=month',
  '/report?id=42', '/reading/42', '/report?slug=12-8-21',
  '/report?birth=1992-08-12&sex=f', '/report?birth=1987-06-14&sex=m',
  '/compatibility?a=1987-06-14&b=1999-05-27',
  '/purchase?product=single&id=42&chapter=material_karma',
  '/purchase?product=single&chapter=purpose&birth=1989-09-21&sex=f',
  '/purchase?product=single&id=42', '/purchase?product=pair&id=81',
  '/purchase?birth=2000-02-29', '/purchase?product=month&birth=1992-08-12&sex=f',
  '/purchase?product=pair&a=1987-06-14&b=1999-05-27',
])('preserves the known, typed native destination %s', target => {
  expect(safeAuthReturn(target)).toBe(target);
});

it.each([
  undefined, null, 42, {}, ['/reading/42'], ['/report?id=42', '/account'],
  'https://arcana-sense.com/account', 'https://example.org', '//example.org/account',
  'javascript:alert(1)', 'arcanasense://account', '/\\example.org', '/account\n', '/account\u0000',
  '/account#https://example.org', '/%61ccount', '/account%0a', '/%2f%2fexample.org',
  '/purchase?product=%70air&a=1987-06-14&b=1999-05-27', '/purchase?product=%2570air',
  '/reading/../account', '/account/../purchase', '/settings', '/login', '/admin',
  '/account?returnTo=//example.org', '/purchase?product=pair&redirect=/account',
  '/report?id=42&id=81', '/purchase?product=single&product=pair', '/report?id=42?birth=1992-08-12',
  '/reading/0', '/reading/-1', '/reading/01', '/reading/1.5', '/reading/9007199254740992',
  '/report?id=1e2', '/report?id=42&birth=1992-08-12', '/report?slug=23-1-1',
  '/report?birth=1991-02-29', '/report?birth=1900-02-29', '/report?birth=2000-02-30',
  '/report?birth=1899-12-31', '/report?birth=9999-01-01', '/report?birth=12.08.1992',
  '/report?birth=1992-08-12&sex=other', '/report?sex=f', '/year?birth=1992-08-12',
  '/compatibility?a=1987-06-14', '/compatibility?a=1987-06-14&b=1999-02-30',
  '/purchase?product=pair&birth=1992-08-12', '/purchase?product=single&a=1987-06-14&b=1999-05-27',
  '/purchase?product=pair&id=42&a=1987-06-14&b=1999-05-27', '/purchase?product=unknown',
  `/purchase?${'a'.repeat(512)}`,
])('falls back safely for an untrusted or ambiguous return target: %p', value => {
  expect(safeAuthReturn(value)).toBe('/account');
});

it('preserves both dates through the real AppLink route and login/register/forgot transitions', () => {
  const target = '/purchase?product=pair&a=1987-06-14&b=1999-05-27';
  let current = target;
  for (const mode of ['login', 'register', 'forgot', 'login'] as const) {
    const href = authHref(mode, current);
    expect(href).toBe(`/${mode}?returnTo=${encodeURIComponent(target)}`);
    const native = internalTarget(href);
    expect(native.external).toBeUndefined();
    const url = new URL(native.path, 'https://native.invalid');
    expect([...url.searchParams.keys()]).toEqual(['returnTo']);
    current = safeAuthReturn(url.searchParams.get('returnTo'));
  }
  expect(current).toBe(target);
});

it('does not decode an attacker-controlled return a second time', () => {
  const onceDecoded = new URL('https://native.invalid/login?returnTo=%252F%252Fevil.invalid').searchParams.get('returnTo');
  expect(safeAuthReturn(onceDecoded)).toBe('/account');
  expect(authHref('register', onceDecoded)).toBe('/register?returnTo=%2Faccount');
});
