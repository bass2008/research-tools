import { expect, it, jest } from '@jest/globals';
import type { ErrorEvent } from '@sentry/react-native';
import { cleanEvent, scrub } from '../errors';
jest.mock('@sentry/react-native', () => ({}));
jest.mock('../config', () => ({ config: { release: 'mobile@test', local: true, errorsDsn: '' } }));
it('removes personal context, routes, breadcrumbs and custom fields from an error', () => {
  const event = cleanEvent({ type: undefined, event_id: 'probe', user: { email: 'private@example.org', id: 'account-id' },
    request: { url: 'https://example.org/report?birth=1987-06-14', headers: { Authorization: 'secret' } },
    breadcrumbs: [{ message: 'Typed private data' }], extra: { password: 'secret' }, tags: { account: 'private' },
    exception: { values: [{ type: 'Error', value: 'private@example.org 1987-06-14 https://example.org/reset#token=secret', stacktrace: { frames: [{ filename: 'index.android.bundle', function: 'openReading', lineno: 20 }] } }] },
    contexts: { device: { model: 'Pixel', id: 'unique-id' }, os: { name: 'Android', version: '15' }, app: { app_start_time: 'private-time' } },
  } as ErrorEvent);
  const serialized = JSON.stringify(event);
  for (const forbidden of ['private@example', '1987-06-14', 'secret', 'unique-id', 'Typed private data', 'account-id', 'private-time']) expect(serialized).not.toContain(forbidden);
  expect(serialized).toContain('openReading'); expect(serialized).toContain('Pixel'); expect(event.release).toBe('mobile@test');
});
it('redacts dates, email, URLs with queries and opaque tokens in arbitrary exception messages', () => {
  const cleaned = scrub('14.06.1987 test@example.org eyJhbGciOiJIUzI1NiJ9.payload.signature https://example.org/report?birth=1987-06-14');
  expect(cleaned).toBe('[date] [email] [token] https://example.org/report');
});
it('does not send arbitrary names or reading text embedded in an exception', () => {
  const event = cleanEvent({ type: undefined, exception: { values: [{ type: 'Custom name', value: 'Иван Петров — частный текст разбора' }] } });
  expect(event.exception?.values?.[0]).toMatchObject({ type: 'Error', value: 'Unexpected application error' });
});
