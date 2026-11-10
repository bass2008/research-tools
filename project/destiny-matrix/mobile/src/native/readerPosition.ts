import { cacheGeneration, readCache, writeCache } from './cache';

interface Position { chapter: string }
export interface ReaderPosition { key: string; owner?: number; epoch: number }
const isPosition = (value: unknown): value is Position => typeof value === 'object' && value !== null
  && 'chapter' in value && typeof value.chapter === 'string' && /^[a-z][a-z0-9_-]{0,79}$/.test(value.chapter);

/** Metadata only. Private positions share the cache's logout/deletion cleanup. */
export function readerPosition(identity: string, account: { userId?: number; deleting?: boolean; base?: string }, publicExample = false, epoch = cacheGeneration()): ReaderPosition | null {
  if (account.deleting && !publicExample) return null;
  // A guest's own dates are private too; signing in clears this guest namespace.
  const owner = publicExample && (!account.userId || account.deleting) ? undefined : account.userId ?? -1;
  return { key: JSON.stringify(['reader-position-v1', owner ?? 'public-example', publicExample ? 'bundled' : account.base, identity]), owner, epoch };
}

export async function readReaderPosition(position: ReaderPosition | null): Promise<string | null> {
  if (!position || position.epoch !== cacheGeneration()) return null;
  const value = await readCache(position.key, isPosition, position.owner);
  return position.epoch === cacheGeneration() ? value?.chapter ?? null : null;
}

export async function saveReaderPosition(position: ReaderPosition | null, chapter: string): Promise<void> {
  if (!position || position.epoch !== cacheGeneration() || !isPosition({ chapter })) return;
  await writeCache(position.key, { chapter }, position.owner === undefined ? undefined : { userId: position.owner, until: null }, position.epoch);
}
