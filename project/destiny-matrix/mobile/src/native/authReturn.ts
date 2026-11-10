const FALLBACK = '/account';
const MAX_RETURN_LENGTH = 512;

function positiveId(value: string | undefined): boolean {
  return !!value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

function birthDate(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && value <= localToday;
}

/** Expo Router has already decoded the outer returnTo parameter once. Never
 * decode or normalize it again: the destination must be a known native screen. */
export function safeAuthReturn(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > MAX_RETURN_LENGTH || !raw.startsWith('/') ||
    raw.startsWith('//') || /[\s\\%#]/.test(raw) || /[^\x21-\x7e]/.test(raw)) return FALLBACK;
  const [path, search, extra] = raw.split('?');
  if (extra !== undefined || search === '' || search !== undefined && !/^[a-zA-Z0-9_=&-]+$/.test(search)) return FALLBACK;
  const query = new URLSearchParams(search);
  const entries = [...query.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return FALLBACK;
  const params = Object.fromEntries(entries) as Record<string, string | undefined>;
  const keys = entries.map(([key]) => key);
  const only = (...allowed: string[]) => keys.every(key => allowed.includes(key));
  const personal = () => birthDate(params.birth) && (params.sex === undefined || params.sex === 'f' || params.sex === 'm');
  const pair = () => birthDate(params.a) && birthDate(params.b);
  let valid = false;
  if (path === '/account' || path === '/year') valid = keys.length === 0;
  else if (/^\/reading\/[1-9]\d*$/.test(path)) valid = keys.length === 0 && positiveId(path.slice('/reading/'.length));
  else if (path === '/compatibility') valid = keys.length === 0 || only('a', 'b') && pair();
  else if (path === '/report') {
    valid = keys.length === 0 || only('id') && positiveId(params.id) || only('birth', 'sex') && personal() ||
      only('slug') && !!params.slug && /^[1-9]\d?-[1-9]\d?-[1-9]\d?$/.test(params.slug) && params.slug.split('-').every(n => Number(n) <= 22);
  } else if (path === '/purchase' && (params.product === undefined || ['single', 'pair', 'month'].includes(params.product))) {
    const chapter = params.chapter === undefined || /^[a-z][a-z0-9_]{0,79}$/.test(params.chapter);
    valid = chapter && (only('product') || only('product', 'id', 'chapter') && positiveId(params.id) ||
      (params.product === 'pair' ? only('product', 'a', 'b') && pair() : only('product', 'birth', 'sex', 'chapter') && personal()));
  }
  return valid ? `${path}${keys.length ? `?${query.toString()}` : ''}` : FALLBACK;
}

export function authHref(mode: 'login' | 'register' | 'forgot', returnTo: unknown): string {
  return `/${mode}?returnTo=${encodeURIComponent(safeAuthReturn(returnTo))}`;
}
