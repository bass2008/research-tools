import type { Lang } from '@/lib/i18n/hosts';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) { super(message); }
}
export type Guard<T> = (data: unknown) => data is T;
export const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export interface Connection { base: string; locale: Lang; token?: string; basic?: string }
export async function request<T>(connection: Connection, path: string, guard: Guard<T>, options: {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; timeout?: number; signal?: AbortSignal; anonymous?: boolean;
} = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path');
  const abort = new AbortController();
  const cancel = () => abort.abort();
  options.signal?.addEventListener('abort', cancel);
  if (options.signal?.aborted) abort.abort();
  const timer = setTimeout(cancel, options.timeout ?? 20000);
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': connection.locale };
  if (connection.token && !options.anonymous) headers['X-Arcana-Session'] = connection.token;
  if (connection.basic) headers.Authorization = `Basic ${connection.basic}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const response = await fetch(`${connection.base}/api${path}`, { headers, credentials: 'omit',
      method: options.method ?? 'GET', body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: abort.signal });
    const raw = await response.text();
    let data: unknown;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    if (!response.ok) {
      const detail = record(data) && typeof data.detail === 'string' ? data.detail :
        connection.locale === 'ru' ? `Сервер ответил ${response.status}` : `Server returned ${response.status}`;
      throw new ApiError(response.status, detail, data);
    }
    if (!guard(data)) throw new ApiError(502, connection.locale === 'ru'
      ? 'Не удалось прочитать ответ. Обновите приложение или повторите позже.'
      : 'Unable to read the response. Update the app or try again later.');
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, connection.locale === 'ru'
      ? 'Нет связи с сервером. Проверьте интернет и повторите.' : 'Cannot reach the server. Check your connection and retry.');
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', cancel); }
}
export const isRecord = record;
export const isEmpty = (data: unknown): data is null => data === null;
