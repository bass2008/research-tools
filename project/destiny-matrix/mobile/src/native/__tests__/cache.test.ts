import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { File } from 'expo-file-system';
import { cacheGeneration, clearPrivateCache, dropCache, privateDir, readCache, revokePrivateAccess, writeCache } from '../cache';
import { readReaderPosition, readerPosition, saveReaderPosition } from '../readerPosition';

// The native file layer is modeled as persistent files, so the tests exercise the
// serialized grants, file-name collisions and a write finishing after logout.
jest.mock('expo-file-system', () => {
  const files = new Map<string, { body: string; modified: number }>();
  const dirs = new Set<string>();
  let tick = 0;
  let gate: Promise<void> | null = null;
  let release: (() => void) | null = null;
  const pathOf = (...parts: (string | { uri: string })[]) => parts.map(p => typeof p === 'string' ? p : p.uri)
    .reduce((base, next) => base.replace(/\/+$/, '') + '/' + next.replace(/^\/+/, ''));
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = pathOf(...parts); }
    get exists() { return files.has(this.uri); }
    get modificationTime() { return files.get(this.uri)?.modified ?? null; }
    textSync() { const value = files.get(this.uri); if (!value) throw new Error('Missing file'); return value.body; }
    async text() { return this.textSync(); }
    async write(body: string) { if (gate) await gate; files.set(this.uri, { body, modified: ++tick }); }
    delete() { files.delete(this.uri); }
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = pathOf(...parts).replace(/\/+$/, '') + '/'; }
    get exists() { return dirs.has(this.uri); }
    create() { dirs.add(this.uri); }
    list() { return [...files.keys()].filter(k => k.startsWith(this.uri)).map(k => new File(k)); }
    delete() { for (const key of files.keys()) if (key.startsWith(this.uri)) files.delete(key); dirs.delete(this.uri); }
  }
  return { File, Directory, Paths: { document: 'file:///documents' }, __test: {
    files,
    reset() { files.clear(); dirs.clear(); tick = 0; gate = null; release = null; },
    pauseWrites() { gate = new Promise<void>(resolve => { release = resolve; }); },
    resumeWrites() { release?.(); gate = null; release = null; },
  } };
});

interface MemoryFiles {
  files: Map<string, { body: string; modified: number }>;
  reset(): void; pauseWrites(): void; resumeWrites(): void;
}
const fs = jest.requireMock<{ __test: MemoryFiles }>('expo-file-system').__test;
const isText = (value: unknown): value is string => typeof value === 'string';
const now = Date.parse('2026-11-08T10:00:00Z');
beforeEach(() => { fs.reset(); jest.spyOn(Date, 'now').mockReturnValue(now); });
afterEach(() => { jest.restoreAllMocks(); });

it('partitions chapter metadata by account/server/reading and keeps guest dates private', async () => {
  const owner = readerPosition('reading:42', { userId: 7, base: 'https://one.test' })!;
  await saveReaderPosition(owner, 'comfort');
  await expect(readReaderPosition(owner)).resolves.toBe('comfort');
  for (const other of [readerPosition('reading:42', { userId: 8, base: 'https://one.test' }),
    readerPosition('reading:42', { userId: 7, base: 'https://two.test' }),
    readerPosition('reading:43', { userId: 7, base: 'https://one.test' }),
    readerPosition('reading:42', { base: 'https://one.test' })]) {
    await expect(readReaderPosition(other)).resolves.toBeNull();
  }
  await saveReaderPosition(readerPosition('guest-date', {}), 'character');
  const saved = [...fs.files.entries()];
  expect(saved).toHaveLength(2);
  expect(saved.every(([path]) => path.startsWith(privateDir().uri))).toBe(true);
  expect(saved.map(([, file]) => JSON.parse(file.body).value)).toEqual([{ chapter: 'comfort' }, { chapter: 'character' }]);
});

it('clears private chapter positions on logout/deletion and rejects in-flight saves, while a guest sample survives', async () => {
  const sample = readerPosition('automatic-demo-v1', {}, true)!;
  await saveReaderPosition(sample, 'rest');
  const personal = readerPosition('reading:42', { userId: 7 })!;
  await saveReaderPosition(personal, 'comfort');
  fs.pauseWrites();
  const pending = saveReaderPosition(personal, 'character');
  clearPrivateCache(); fs.resumeWrites(); await pending;
  await expect(readReaderPosition(readerPosition('reading:42', { userId: 7 }))).resolves.toBeNull();
  await expect(readReaderPosition(readerPosition('automatic-demo-v1', {}, true))).resolves.toBe('rest');
  expect(readerPosition('reading:42', { userId: 7, deleting: true })).toBeNull();
  await saveReaderPosition(personal, 'years');
  expect([...fs.files.values()].map(file => JSON.parse(file.body).value)).toEqual([{ chapter: 'rest' }]);
});

it('returns a purchased report only to its owner, never to a guest or a different account', async () => {
  await writeCache('reading:42', 'private reading', { userId: 7, until: null });
  await expect(readCache('reading:42', isText, 7)).resolves.toBe('private reading');
  await expect(readCache('reading:42', isText)).resolves.toBeNull();
  await expect(readCache('reading:42', isText, 8)).resolves.toBeNull();
});

it.each(['2026-11-08T09:59:59Z', '2026-11-08T10:00:00Z', 'not-a-date'])('does not reuse subscription content after an expired or invalid grant: %s', async until => {
  await writeCache('subscription-reading', 'full text', { userId: 7, until });
  await expect(readCache('subscription-reading', isText, 7)).resolves.toBeNull();
  expect(fs.files.size).toBe(0);
});

it('permits an unexpired subscription and denies it when that same saved grant expires', async () => {
  await writeCache('subscription-reading', 'full text', { userId: 7, until: '2026-11-08T10:01:00Z' });
  await expect(readCache('subscription-reading', isText, 7)).resolves.toBe('full text');
  jest.spyOn(Date, 'now').mockReturnValue(now + 60000);
  await expect(readCache('subscription-reading', isText, 7)).resolves.toBeNull();
});

it('clears private files on logout while keeping public articles available offline', async () => {
  await writeCache('article:5', 'public article');
  await writeCache('reading:42', 'private reading', { userId: 7, until: null });
  const before = cacheGeneration();
  clearPrivateCache();
  expect(cacheGeneration()).toBeGreaterThan(before);
  await expect(readCache('reading:42', isText, 7)).resolves.toBeNull();
  await expect(readCache('article:5', isText, 8)).resolves.toBe('public article');
});

it('does not resurrect an account cache from a request started before logout', async () => {
  const started = cacheGeneration();
  clearPrivateCache();
  await writeCache('reading:42', 'late response', { userId: 7, until: null }, started);
  expect(fs.files.size).toBe(0);
});

it('removes a private write that completes while logout is deleting files', async () => {
  const started = cacheGeneration();
  fs.pauseWrites();
  const pending = writeCache('reading:42', 'late disk write', { userId: 7, until: null }, started);
  clearPrivateCache();
  fs.resumeWrites();
  await pending;
  await expect(readCache('reading:42', isText, 7)).resolves.toBeNull();
  expect(fs.files.size).toBe(0);
});

it('checks the complete stored key even when two keys have the same file-name hash', async () => {
  // These two distinct keys collide in the current 32-bit FNV file-name scheme.
  const a = 'report:2963u1:private', b = 'report:14uxs7h:private';
  await writeCache(a, 'first report', { userId: 7, until: null });
  await writeCache(b, 'other report', { userId: 7, until: null });
  expect(fs.files.size).toBe(1);
  await expect(readCache(a, isText, 7)).resolves.toBeNull();
});

it('treats an incompatible saved response or broken JSON as a cache miss', async () => {
  await writeCache('bad-shape', { private: 'object instead of text' });
  await expect(readCache('bad-shape', isText)).resolves.toBeNull();
  await writeCache('broken-json', 'text');
  const saved = [...fs.files.values()][0];
  saved.body = '{truncated';
  await expect(readCache('broken-json', isText)).resolves.toBeNull();
});

it('drops both public and private copies after an explicit access denial', async () => {
  await writeCache('reading:42', 'preview');
  await writeCache('reading:42', 'full reading', { userId: 7, until: null });
  dropCache('reading:42');
  await expect(readCache('reading:42', isText, 7)).resolves.toBeNull();
  expect(fs.files.size).toBe(0);
});

it('removes a refunded reading and its PDF when the native directory URI ends in a slash', async () => {
  const dir = privateDir(); dir.create({ idempotent: true, intermediates: true });
  expect(dir.uri.endsWith('/')).toBe(true);
  const pdf = new File(dir, 'report-7-42-en.pdf');
  await pdf.write('%PDF-private');
  await writeCache('pdf:7:42', { uri: pdf.uri }, { userId: 7, until: null, readingId: 42 });
  await writeCache('reading:7:42', 'refunded text', { userId: 7, until: null, readingId: 42 });
  await writeCache('reading:7:43', 'other purchase', { userId: 7, until: null, readingId: 43 });
  await writeCache('reading:8:42', 'other account', { userId: 8, until: null, readingId: 42 });
  const before = cacheGeneration();
  revokePrivateAccess(7, 42);
  expect(cacheGeneration()).toBeGreaterThan(before);
  expect(pdf.exists).toBe(false);
  expect([...fs.files.values()].some(entry => entry.body.includes(pdf.uri))).toBe(false);
  await expect(readCache('reading:7:42', isText, 7)).resolves.toBeNull();
  await expect(readCache('reading:7:43', isText, 7)).resolves.toBe('other purchase');
  await expect(readCache('reading:8:42', isText, 8)).resolves.toBe('other account');
  await writeCache('late-refunded-reading', 'late text', { userId: 7, until: null, readingId: 42 }, before);
  await expect(readCache('late-refunded-reading', isText, 7)).resolves.toBeNull();
});

it('removes subscription and legacy grants on subscription revocation while preserving permanent purchases', async () => {
  await writeCache('subscription', 'subscription text', { userId: 7, until: '2026-12-01T00:00:00Z', readingId: 42 });
  await writeCache('legacy', 'unknown ownership scope', { userId: 7, until: null });
  await writeCache('permanent', 'purchased forever', { userId: 7, until: null, readingId: 43 });
  revokePrivateAccess(7, null);
  await expect(readCache('subscription', isText, 7)).resolves.toBeNull();
  await expect(readCache('legacy', isText, 7)).resolves.toBeNull();
  await expect(readCache('permanent', isText, 7)).resolves.toBe('purchased forever');
});

it('does not delete a file outside the private directory when removing its revoked metadata', async () => {
  const outside = new File('file:///documents/private-v1-neighbor/report.pdf');
  await outside.write('%PDF-outside');
  await writeCache('misplaced-pdf', { uri: outside.uri }, { userId: 7, until: null, readingId: 42 });
  revokePrivateAccess(7, 42);
  expect(outside.exists).toBe(true);
  expect(fs.files.size).toBe(1);
});
