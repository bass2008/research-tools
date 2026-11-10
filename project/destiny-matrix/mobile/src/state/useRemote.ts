import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ApiError, type Guard } from '../native/http';
import { cacheGeneration, dropCache, readCache, writeCache, type Grant } from '../native/cache';
import { useApp } from './AppState';

interface RemoteState<T> {
  key: string; data?: T; error?: string; loading: boolean; offline: boolean;
  grant?: Grant; generation?: number;
}
function grantValid(grant: Grant | undefined, userId: number | undefined) {
  return !grant || grant.userId === userId && (grant.until === null || Date.parse(grant.until) > Date.now());
}
function currentState<T>(state: RemoteState<T>, key: string, userId: number | undefined, scoped: boolean) {
  return state.key === key && (!(scoped || state.grant) || state.generation === cacheGeneration()) && grantValid(state.grant, userId);
}

export function useRemote<T>(path: string | null, guard: Guard<T>, options: {
  private?: boolean;
  grant?: (value: T) => Grant | undefined;
  load?: () => Promise<T>;
  cache?: boolean;
  accountScoped?: boolean;
} = {}) {
  const app = useApp();
  const key = JSON.stringify([1, app.base, app.locale, path, options.private || options.accountScoped ? app.session?.user.id ?? null : 'public']);
  const [state, setState] = useState<RemoteState<T>>({ key, loading: true, offline: false });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(r => r + 1), []);
  const refs = useRef({ app, guard, options });
  useLayoutEffect(() => { refs.current = { app, guard, options }; });
  useFocusEffect(useCallback(() => {
    reload();
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') reload(); });
    // Recheck a subscription even when the user keeps the reader open across its expiry.
    const timer = setInterval(reload, 60000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [reload]));
  useEffect(() => {
    if (state.key !== key || !state.grant?.until) return;
    const remaining = Date.parse(state.grant.until) - Date.now();
    if (!(remaining > 0)) return;
    // Expire visible text at the known deadline, including while a refresh hangs.
    const timer = setTimeout(reload, Math.min(remaining, 2147483647));
    return () => clearTimeout(timer);
  }, [key, state.key, state.grant?.until, revision, reload]);
  useEffect(() => {
    let live = true;
    const { app: current, guard: validate, options: opt } = refs.current;
    if (!path || !current.ready || (opt.private && (!current.session || current.session.deletion))) {
      return;
    }
    const userId = current.session?.user.id;
    const generation = cacheGeneration();
    const scoped = !!(opt.private || opt.accountScoped);
    const grantFor = (value: T) => opt.grant?.(value) ?? (opt.private && userId ? { userId, until: null } : undefined);
    void (async () => {
      await Promise.resolve();
      if (!live) return;
      setState(previous => currentState(previous, key, userId, scoped) && previous.data !== undefined
        ? { ...previous, error: undefined, loading: false }
        : { key, loading: true, offline: false, generation });
      try {
        const value = await (opt.load ? opt.load() : current.api(path, validate));
        if (!live) return;
        if (!validate(value)) throw new ApiError(502, current.t('Ответ сервера не поддерживается', 'Unsupported server response'));
        const grant = grantFor(value);
        if (opt.cache !== false) await writeCache(key, value, grant, generation);
        if (!grantValid(grant, userId)) throw new ApiError(403, current.t('Срок доступа истёк', 'Access has expired'));
        if (live && (!(scoped || grant) || generation === cacheGeneration())) setState({ key, data: value, grant, generation, loading: false, offline: false });
      } catch (error) {
        if (!live) return;
        const status = error instanceof ApiError ? error.status : 0;
        if ([401, 402, 403, 404, 410].includes(status)) dropCache(key);
        const transient = status === 0 || status === 429 || status >= 500;
        const cached = opt.cache !== false && transient ? await readCache(key, validate, userId) : null;
        if (live && (!scoped || generation === cacheGeneration())) setState(previous => {
          const retain = transient && currentState(previous, key, userId, scoped);
          const grant = cached ? grantFor(cached) : retain ? previous.grant : undefined;
          const data = grantValid(grant, userId) ? cached ?? (retain ? previous.data : undefined) : undefined;
          return { key, data, grant: data === undefined ? undefined : grant, generation, loading: false, offline: data !== undefined,
            error: data !== undefined ? undefined : error instanceof Error ? error.message : current.t('Не удалось загрузить', 'Unable to load') };
        });
      }
    })();
    return () => { live = false; };
  }, [key, revision, app.ready, app.version, path]);
  const disabled = !path || (options.private && (!app.session || app.session.deletion));
  const visible = disabled ? { key, loading: false, offline: false } : currentState(state, key, app.session?.user.id, !!(options.private || options.accountScoped))
    ? state : { key, loading: true, offline: false };
  return { data: visible.data, error: visible.error, loading: visible.loading, offline: visible.offline, reload };
}
