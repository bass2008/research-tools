import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { Lang } from '@/lib/i18n/hosts';
import { config } from '../native/config';
import { clearPrivateCache, revokePrivateAccess } from '../native/cache';
import { ApiError, request, type Guard, type Connection } from '../native/http';
import { isSession, type Session } from '../native/contracts';

type Options = Parameters<typeof request>[3];
interface State {
  locale: Lang; setLocale: (locale: Lang) => void;
  session: Session | null; authenticate: (session: Session) => Promise<void>; logout: () => Promise<void>;
  base: string; setBase: (base: string) => Promise<void>; ready: boolean; storageError: string;
  connection: Connection; version: number;
  invalidateAccess: (readingId?: number | null) => void;
  api: <T>(path: string, guard: Guard<T>, options?: Options) => Promise<T>;
  t: (ru: string, en: string) => string;
}
const Context = createContext<State | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [locale, changeLocale] = useState<Lang>('ru');
  const [session, changeSession] = useState<Session | null>(null);
  const [base, changeBase] = useState(config.apiBase);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [version, setVersion] = useState(0);
  const epoch = useRef(0);
  const sessionRef = useRef(session);
  useLayoutEffect(() => { sessionRef.current = session; }, [session]);
  const queue = useRef(Promise.resolve());
  const persist = useCallback((operation: () => Promise<void>) => {
    queue.current = queue.current.catch(() => {}).then(operation);
    return queue.current;
  }, []);
  useEffect(() => {
    let live = true;
    void Promise.all([SecureStore.getItemAsync('arcana.locale'), SecureStore.getItemAsync('arcana.session'),
      SecureStore.getItemAsync('arcana.base')]).then(([l, s, b]) => {
      if (!live) return;
      if (l === 'ru' || l === 'en') changeLocale(l);
      if (config.local && b) changeBase(b);
      if (s) { try { const value: unknown = JSON.parse(s); if (isSession(value)) changeSession(value); } catch {} }
    }).catch(() => { if (live) setStorageError('Не удалось открыть защищённое хранилище / Secure storage unavailable'); })
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  const logout = useCallback(async () => {
    epoch.current++;
    sessionRef.current = null; changeSession(null); setVersion(v => v + 1);
    try { clearPrivateCache(); } catch { setStorageError('Не удалось очистить файлы. Очистите данные приложения / Clear app storage to remove cached files'); }
    await persist(() => SecureStore.deleteItemAsync('arcana.session'));
  }, [persist]);
  const authenticate = useCallback(async (next: Session) => {
    epoch.current++;
    const start = epoch.current;
    if (sessionRef.current?.user.id !== next.user.id || next.deletion) clearPrivateCache();
    await persist(() => SecureStore.setItemAsync('arcana.session', JSON.stringify(next)));
    if (start !== epoch.current) return;
    sessionRef.current = next; changeSession(next); setVersion(v => v + 1);
  }, [persist]);
  const setLocale = useCallback((next: Lang) => {
    changeLocale(next);
    void persist(() => SecureStore.setItemAsync('arcana.locale', next)).catch(() => setStorageError('Language could not be saved'));
  }, [persist]);
  const setBase = useCallback(async (next: string) => {
    if (!config.local) return;
    const url = new URL(next);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Введите адрес сервера / Enter the server origin');
    await logout(); await persist(() => SecureStore.setItemAsync('arcana.base', url.origin)); changeBase(url.origin);
  }, [logout, persist]);
  const connection = useMemo(() => ({ base, locale, token: session?.token }), [base, locale, session?.token]);
  const invalidateAccess = useCallback((readingId?: number | null) => {
    if (readingId !== undefined && sessionRef.current) revokePrivateAccess(sessionRef.current.user.id, readingId);
    setVersion(v => v + 1);
  }, []);
  const api = useCallback(async <T,>(path: string, guard: Guard<T>, options?: Options) => {
    const start = epoch.current;
    try {
      const result = await request(connection, path, guard, options);
      if (start !== epoch.current) throw new ApiError(409, connection.locale === 'ru' ? 'Аккаунт изменился. Повторите действие.' : 'The account changed. Please retry.');
      return result;
    }
    catch (e) {
      if (e instanceof ApiError && e.status === 401 && !options?.anonymous && connection.token && start === epoch.current && sessionRef.current?.token === connection.token) await logout();
      throw e;
    }
  }, [connection, logout]);
  const value = useMemo(() => ({ locale, setLocale, session, authenticate, logout, base, setBase, ready,
    storageError, connection, api, version, invalidateAccess, t: (ru: string, en: string) => locale === 'ru' ? ru : en,
  }), [locale, setLocale, session, authenticate, logout, base, setBase, ready, storageError, connection, api, version, invalidateAccess]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApp() { const state = useContext(Context); if (!state) throw new Error('AppProvider missing'); return state; }
