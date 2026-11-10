import { Directory, File, Paths } from 'expo-file-system';
import type { Guard } from './http';

export interface Grant { userId: number; until: string | null; readingId?: number }
export interface Entry { key: string; value: unknown; storedAt: number; grant?: Grant }
export function usable(entry: Entry, key: string, userId: number | undefined, now = Date.now()): boolean {
  if (entry.key !== key) return false;
  return !entry.grant || (entry.grant.userId === userId &&
    (entry.grant.until === null || Date.parse(entry.grant.until) > now));
}
const publicDir = () => new Directory(Paths.document, 'public-v1');
export const privateDir = () => new Directory(Paths.document, 'private-v1');
let generation = 0;
export function cacheGeneration() { return generation; }
function name(key: string) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return `${hash >>> 0}.json`;
}
function file(key: string, privateData: boolean) {
  const dir = privateData ? privateDir() : publicDir();
  dir.create({ idempotent: true, intermediates: true });
  return new File(dir, name(key));
}
export async function readCache<T>(key: string, guard: Guard<T>, userId?: number): Promise<T | null> {
  for (const privateData of userId ? [true, false] : [false]) {
    try {
      const f = file(key, privateData);
      if (!f.exists) continue;
      const entry = JSON.parse(await f.text()) as Entry;
      if (usable(entry, key, userId) && guard(entry.value)) return entry.value;
      f.delete();
    } catch { /* A corrupted cache is a miss, never an authorization source. */ }
  }
  return null;
}
export async function writeCache(key: string, value: unknown, grant?: Grant, epoch = generation) {
  if (grant && epoch !== generation) return;
  try {
    const f = file(key, !!grant);
    const serialized = JSON.stringify({ key, value, grant, storedAt: Date.now() });
    if (serialized.length > 3_000_000) return;
    await f.write(serialized);
    // Logout while a write was in flight cannot recreate another account's cache.
    if (grant && epoch !== generation && f.exists) f.delete();
    const dir = grant ? privateDir() : publicDir();
    const files = dir.list().filter((entry): entry is File => entry instanceof File)
      .sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0));
    for (const old of files.slice(100)) old.delete();
  } catch { /* No space or inaccessible storage: reading still works online. */ }
}
export function dropCache(key: string) {
  for (const priv of [true, false]) { try { const f = file(key, priv); if (f.exists) f.delete(); } catch {} }
}
export function clearPrivateCache() {
  generation++;
  const dir = privateDir();
  if (dir.exists) dir.delete();
}

/** A confirmed refund/expiry invalidates affected text and internal PDFs immediately. */
export function revokePrivateAccess(userId: number, readingId: number | null) {
  generation++;
  const dir = privateDir();
  if (!dir.exists) return;
  for (const f of dir.list()) {
    if (!(f instanceof File) || !f.uri.endsWith('.json')) continue;
    try {
      const entry = JSON.parse(f.textSync()) as Entry;
      if (entry.grant?.userId !== userId) continue;
      const affected = entry.grant.readingId === undefined || (readingId === null ? entry.grant.until !== null : entry.grant.readingId === readingId);
      if (!affected) continue;
      if (typeof entry.value === 'object' && entry.value !== null && 'uri' in entry.value && typeof entry.value.uri === 'string' && entry.value.uri.startsWith(dir.uri.replace(/\/+$/, '') + '/')) {
        const pdf = new File(entry.value.uri); if (pdf.exists) pdf.delete();
      }
      f.delete();
    } catch { /* Corrupt entries are rejected by readCache. */ }
  }
}
