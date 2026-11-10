import { expect, it } from '@jest/globals';
import { internalTarget } from '../navigation';
import { redirectSystemPath } from '../../app/+native-intent';

it('keeps the Metro launcher out of product routing after activity recreation', () => {
  expect(redirectSystemPath({ path: 'exp+arcana-sense://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081', initial: true })).toBe('/');
});

it.each([
  ['/ru', '/', 'ru'],
  ['/en/account', '/account', 'en'],
  ['https://arcana-sense.ru/ru/matrices/42', '/report?id=42', 'ru'],
  ['https://test.arcana-sense.com/en/readings/9', '/reading/9', 'en'],
  ['https://arcana-sense.com/ru/account/delete', '/settings', 'ru'],
  ['https://arcana-sense.com/en/account/delete?from=email', '/settings?from=email', 'en'],
  ['/ru/encyclopedia/arcanum/5?tab=combos', '/encyclopedia/arcanum/5?tab=combos', 'ru'],
  ['/en/purchase?product=pair&id=8', '/purchase?product=pair&id=8', 'en'],
])('maps a supported website URL %s to its native route', (url, path, locale) => {
  expect(internalTarget(url)).toEqual({ path, locale });
});

it.each(['/reset', '/account/confirm'])('reads the existing e-mail fragment token on %s without losing its locale or kind', path => {
  const target = internalTarget(`https://arcana-sense.com/en${path}#token=single%2Buse%2Ftoken&kind=change_email`);
  expect(target.locale).toBe('en');
  expect(target.external).toBeUndefined();
  const url = new URL(target.path, 'https://native.invalid');
  expect(url.pathname).toBe(path);
  expect(url.searchParams.get('token')).toBe('single+use/token');
  expect(url.searchParams.get('kind')).toBe('change_email');
  expect(url.hash).toBe('');
});

it('uses the fragment token if an old query token is also present', () => {
  const result = internalTarget('/ru/reset?token=old#token=new');
  expect(result).toEqual({ locale: 'ru', path: '/reset?token=new' });
});

it.each(['/support', '/contacts', '/privacy', '/terms', '/refund', '/year/5'])('opens shared article content natively: %s', path => {
  expect(internalTarget(`/en${path}`)).toEqual({ locale: 'en', path: `/article?path=${encodeURIComponent(path)}` });
});

it.each([
  'https://arcana-sense.com/en/s/shared-token',
  'https://arcana-sense.com/ru/matrix/individual/2000-01-01',
  'https://arcana-sense.com/en/admin',
  'https://arcana-sense.com/payment-history',
  'https://arcana-sense.com/encyclopedia-invalid',
  'https://example.org/en/account',
  'https://arcana-sense.com.attacker.invalid/ru/account',
  'https://arcana-sense.com@attacker.invalid/account',
])('keeps unsupported pages and other hosts in the browser: %s', url => {
  expect(internalTarget(url)).toMatchObject({ path: url, external: true });
});

it.each(['mailto:support@arcana-sense.com', 'tel:+123456789'])('preserves an external contact link: %s', url => {
  expect(internalTarget(url)).toEqual({ path: url, external: true });
});

it.each(['javascript:alert(1)', 'data:text/html,hello', 'file:///private/session', 'intent://account', 'ftp://arcana-sense.com/account'])('rejects an unsafe or unsupported protocol: %s', url => {
  expect(() => internalTarget(url)).toThrow('Unsupported link');
});
