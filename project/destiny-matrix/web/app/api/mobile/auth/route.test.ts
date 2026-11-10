import { afterEach, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'arcana-sense.ru' }), cookies: async () => ({ get: () => undefined }) }));
import { POST as login } from './login/route';
import { POST as register } from './register/route';
import { POST as reset } from './reset/apply/route';
import { POST as confirm } from './confirm/route';
afterEach(() => vi.unstubAllGlobals());
function request(body: object) { return new Request('https://arcana-sense.ru/api/mobile/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
it.each([login, register, reset])('returns native auth tokens in JSON without browser cookies', async handler => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ token: 'mobile-token', user: { id: 1 } })));
  const result = await handler(request({ email: 'test@example.org', password: 'correct-password', token: 'single-use-reset-token-valid' }));
  expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ token: 'mobile-token' });
  expect(result.headers.get('set-cookie')).toBeNull();
});
it('email confirmation uses only its operation token, never the current account', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ changed: true })); vi.stubGlobal('fetch', fetcher);
  const req = request({ kind: 'change_email', token: 'single-use-confirmation-token' }); req.headers.set('X-Arcana-Session', 'unrelated-account');
  expect((await confirm(req)).status).toBe(200);
  expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')).toBeNull();
});
it('rejects an unsupported email operation before calling upstream', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect((await confirm(request({ kind: 'delete', token: 'single-use-confirmation-token' }))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
