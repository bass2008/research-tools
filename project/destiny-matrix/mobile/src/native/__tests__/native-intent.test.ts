import { expect, it } from '@jest/globals';
import { redirectSystemPath } from '../../app/+native-intent';

it.each([
  ['arcanasense:///report?birth=2000-01-01', '/report?birth=2000-01-01'],
  ['arcanasense://report?id=42', '/report?id=42'],
  ['arcanasense:report?id=42', '/report?id=42'],
  ['arcanasense:///en/readings/42', '/reading/42?lang=en'],
  ['arcanasense://ru/account/delete', '/settings?lang=ru'],
  ['arcanasense:///en/reset#token=a%2Bb&kind=password', '/reset?token=a%2Bb&kind=password&lang=en'],
  ['arcanasense://ru/account/confirm#token=single-use', '/account/confirm?token=single-use&lang=ru'],
  ['arcanasense:///', '/'],
  ['exp+arcana-sense://', '/'],
  ['exp+arcana-sense://?__expo_url=http%3A%2F%2F127.0.0.1%3A8081', '/'],
  ['exp+arcana-sense://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081', '/'],
  ['arcanasense://', '/'],
  ['/', '/'],
  ['https://arcana-sense.com/en/account/delete', '/settings?lang=en'],
])('opens the native destination for %s', (path, expected) => {
  expect(redirectSystemPath({ path, initial: true })).toBe(expected);
  expect(redirectSystemPath({ path, initial: false })).toBe(expected);
});

it('keeps a supported custom scheme from generating an accidental double slash website path', () => {
  expect(redirectSystemPath({ path: 'arcanasense:///encyclopedia/arcanum/5', initial: true }))
    .toBe('/encyclopedia/arcanum/5');
});

it('sends a legitimate unsupported website page to the external link screen', () => {
  const path = 'https://arcana-sense.com/en/s/share-token';
  expect(redirectSystemPath({ path, initial: true })).toBe(`/external?url=${encodeURIComponent(path)}`);
});

it.each(['javascript:alert(1)', 'file:///private/token', 'http://[invalid'])('rejects an unsafe or malformed system link %s', path => {
  expect(redirectSystemPath({ path, initial: true })).toBe('/+not-found');
});
