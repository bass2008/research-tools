import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { ApiError, isEmpty, isRecord, request } from '../http';

const connection = { base: 'https://private-test.invalid', locale: 'en' as const, token: 'session-secret', basic: 'edge-secret' };
const originalFetch = globalThis.fetch;
let fetchMock: jest.Mock<typeof fetch>;
function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => typeof body === 'string' ? body : JSON.stringify(body) } as Response;
}

beforeEach(() => { fetchMock = jest.fn<typeof fetch>(); globalThis.fetch = fetchMock as typeof fetch; });
afterEach(() => { globalThis.fetch = originalFetch; jest.useRealTimers(); });

it('sends the session and edge authorization separately, without credentials in the URL or cookies', async () => {
  fetchMock.mockResolvedValue(response(200, { ok: true }));
  await expect(request(connection, '/readings?locale=en', isRecord, { method: 'POST', body: { product: 'pair' } })).resolves.toEqual({ ok: true });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe('https://private-test.invalid/api/readings?locale=en');
  expect(url).not.toContain(connection.token);
  expect(url).not.toContain(connection.basic);
  expect(options).toMatchObject({ credentials: 'omit', method: 'POST', body: '{"product":"pair"}', headers: {
    'X-Arcana-Session': connection.token, Authorization: 'Basic edge-secret',
    'Accept-Language': 'en', 'Content-Type': 'application/json',
  } });
});

it.each([401, 402, 403, 404, 429, 500, 502, 503])('preserves HTTP %i so cache/auth callers can distinguish revocation from temporary failure', async status => {
  fetchMock.mockResolvedValue(response(status, { detail: 'Localized server message', code: 'test' }));
  await expect(request(connection, '/readings/3', isRecord)).rejects.toMatchObject({
    status, message: 'Localized server message', data: { detail: 'Localized server message', code: 'test' },
  });
});

it('keeps a 401 classification when a proxy returns HTML, without exposing its body', async () => {
  fetchMock.mockResolvedValue(response(401, '<html>proxy at private-test.invalid session-secret</html>'));
  const error = await request(connection, '/account', isRecord).catch(e => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 401, message: 'Server returned 401', data: null });
  expect(error.message).not.toMatch(/private-test|session-secret/);
});

it.each(['not json', '{"unexpected":"shape"}'])('treats a successful unsupported contract as 502, not an empty successful value: %s', async body => {
  fetchMock.mockResolvedValue(response(200, body));
  const isItems = (v: unknown): v is { items: unknown[] } => isRecord(v) && Array.isArray(v.items);
  await expect(request(connection, '/readings', isItems)).rejects.toMatchObject({ status: 502 });
});

it('accepts an intentionally empty 204 response with its own guard', async () => {
  fetchMock.mockResolvedValue(response(204, ''));
  await expect(request(connection, '/account', isEmpty, { method: 'DELETE' })).resolves.toBeNull();
});

it.each(['ru', 'en'] as const)('sanitizes network exception messages in %s', async locale => {
  fetchMock.mockRejectedValue(new Error(`TLS failed at ${connection.base}/api/account?token=${connection.token}, ${connection.basic}`));
  const error = await request({ ...connection, locale }, '/account', isRecord).catch(e => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(0);
  expect(error.message).not.toMatch(/private-test|session-secret|edge-secret|TLS|https:/);
  expect(error.data).toBeUndefined();
});

it.each(['https://attacker.invalid/account', '//attacker.invalid/account', 'account'])('rejects an absolute or malformed API path before sending the session: %s', async path => {
  await expect(request(connection, path, isRecord)).rejects.toThrow('Invalid API path');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('cancels a timed out request and still returns a sanitized connection error', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options!.signal!.addEventListener('abort', () => reject(new Error('Aborted at private-test.invalid')));
  }));
  const result = request(connection, '/reports/pdf', isRecord, { timeout: 25 }).catch(e => e);
  await jest.advanceTimersByTimeAsync(25);
  expect(await result).toMatchObject({ status: 0 });
  expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

it('propagates caller cancellation to fetch and removes the subscription afterwards', async () => {
  const controller = new AbortController();
  const remove = jest.spyOn(controller.signal, 'removeEventListener');
  fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options!.signal!.addEventListener('abort', () => reject(new Error('request canceled')));
  }));
  const result = request(connection, '/readings', isRecord, { signal: controller.signal }).catch(e => e);
  controller.abort();
  expect(await result).toMatchObject({ status: 0 });
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
});
