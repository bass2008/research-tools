import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useApp } from './AppState';
import { cacheGeneration, readCache, writeCache } from '../native/cache';
import { readerPosition, saveReaderPosition } from '../native/readerPosition';

const isReadKeys = (value: unknown): value is string[] => Array.isArray(value)
  && value.every(key => typeof key === 'string' && /^[a-z][a-z0-9_-]{0,79}$/.test(key));

export function useReadingProgress(identity: string) {
  const { session, base } = useApp();
  const owner = session?.user.id, deleting = !!session?.deletion, epoch = cacheGeneration();
  const position = useMemo(() => readerPosition(identity, { userId: owner, deleting, base }, false, epoch),
    [identity, owner, deleting, base, epoch]);
  const key = position ? `${position.key}:completed` : '';
  const [state, setState] = useState<{ key: string; keys: string[] }>({ key: '', keys: [] });
  useFocusEffect(useCallback(() => {
    let live = true;
    if (position) void readCache(key, isReadKeys, position.owner).then(keys => {
      if (live && epoch === cacheGeneration()) setState({ key, keys: keys ?? [] });
    });
    return () => { live = false; };
  }, [key, position, epoch]));
  const readKeys = state.key === key ? state.keys : [];
  const complete = async (chapter: string) => {
    if (!position || epoch !== cacheGeneration()) return;
    const previous = await readCache(key, isReadKeys, position.owner) ?? [];
    const keys = [...new Set([...previous, chapter])];
    await writeCache(key, keys, { userId: position.owner!, until: null }, epoch);
    if (epoch === cacheGeneration()) setState({ key, keys });
  };
  return { readKeys, complete, remember: (chapter: string) => saveReaderPosition(position, chapter) };
}
