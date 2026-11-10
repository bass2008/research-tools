import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ReadingActions } from '../ReadingActions';
import { clearPrivateCache, privateDir, readCache, writeCache } from '../../native/cache';
import { ApiError, isRecord } from '../../native/http';

const mockApi = jest.fn<(...args: unknown[]) => Promise<{ url: string }>>();
jest.mock('../../state/AppState', () => ({ useApp: () => ({
  api: mockApi, base: 'https://arcana-sense.com', locale: 'en',
  session: { user: { id: 7 }, token: 'account-token-must-not-reach-storage' },
  t: (_ru: string, en: string) => en,
}) }));
jest.mock('../AppLink', () => ({ useNavigate: () => jest.fn() }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) }));

// SDK 58 File.write/move are async; move changes the instance URI. A download
// may leave a partial destination on Android, so model that file separately.
jest.mock('expo-file-system', () => {
  const files = new Map<string, { body: string; modified: number }>();
  const dirs = new Set<string>();
  const events: string[] = [];
  let tick = 0;
  const pathOf = (...parts: (string | { uri: string })[]) => parts.map(p => typeof p === 'string' ? p : p.uri)
    .reduce((base, next) => base.replace(/\/+$/, '') + '/' + next.replace(/^\/+/, ''));
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = pathOf(...parts); }
    get exists() { return files.has(this.uri); }
    get modificationTime() { return files.get(this.uri)?.modified ?? null; }
    textSync() { const value = files.get(this.uri); if (!value) throw new Error('Missing file'); return value.body; }
    async text() { return this.textSync(); }
    async write(body: string) { files.set(this.uri, { body, modified: ++tick }); }
    delete() { events.push(`delete:${this.uri}`); files.delete(this.uri); }
    open() {
      const body = this.textSync();
      return { readBytesSync: (count: number) => Uint8Array.from(body.slice(0, count), ch => ch.charCodeAt(0)),
        close: () => { events.push('close-handle'); } };
    }
    async move(destination: File, options?: { overwrite?: boolean }) {
      if (!this.exists) throw new Error('Missing source');
      if (destination.exists && !options?.overwrite) throw new Error('Destination exists');
      events.push('move');
      const data = files.get(this.uri)!; files.delete(this.uri); files.set(destination.uri, data);
      this.uri = destination.uri;
    }
    canPreview = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
    preview = jest.fn<() => Promise<void>>().mockImplementation(async () => { events.push(`preview:${this.uri}`); });
    static downloadFileAsync = jest.fn();
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
    files, events, reset() { files.clear(); dirs.clear(); events.length = 0; tick = 0; },
  } };
});

interface MemoryFiles { files: Map<string, { body: string; modified: number }>; events: string[]; reset(): void }
const fs = jest.requireMock<{ __test: MemoryFiles }>('expo-file-system').__test;
const key = JSON.stringify(['pdf-v1', 'https://arcana-sense.com', 'en', 7, 42]);
const pdfUri = 'file:///documents/private-v1/report-7-42-en.pdf';
const validPdf = '%PDF-1.7\nNew complete report';
const oldPdf = '%PDF-1.7\nPrevious complete report';
const downloads = jest.mocked(File.downloadFileAsync);
const signedUrl = 'https://storage.example.org/report?token=signed-report-token';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(ok => { resolve = ok; });
  return { promise, resolve };
}
async function seedPdf() {
  const dir = privateDir(); dir.create({ idempotent: true, intermediates: true });
  await new File(pdfUri).write(oldPdf);
  await writeCache(key, { uri: pdfUri }, { userId: 7, until: null, readingId: 42 });
}
async function pressPdf() {
  await render(<ReadingActions id={42} unlocked until={null} />);
  await fireEvent.press(screen.getByTestId('reading-pdf'));
}
async function finished() {
  await waitFor(() => expect(screen.getByTestId('reading-pdf').props.accessibilityState.busy).toBe(false));
}
beforeEach(() => {
  fs.reset(); jest.clearAllMocks();
  mockApi.mockResolvedValue({ url: signedUrl });
  downloads.mockImplementation(async (_url, destination) => {
    const file = destination as File; await file.write(validPdf); return file;
  });
});
afterEach(() => { jest.restoreAllMocks(); });

it('keeps the previous PDF intact until the temporary download passes its header check', async () => {
  await seedPdf();
  const download = deferred<void>();
  let temporary = '';
  downloads.mockImplementation(async (_url, destination) => {
    const file = destination as File; temporary = file.uri;
    await file.write('%PDF-partial'); await download.promise; await file.write(validPdf); return file;
  });
  await pressPdf();
  await waitFor(() => expect(temporary).not.toBe(''));
  expect(temporary).toMatch(/\/download-.*\.part$/);
  expect(fs.files.get(pdfUri)?.body).toBe(oldPdf);
  expect(fs.events).not.toContain('move');
  await act(async () => { download.resolve(); });
  await finished();
  expect(fs.files.get(pdfUri)?.body).toBe(validPdf);
  expect(fs.files.has(temporary)).toBe(false);
  expect(fs.events.indexOf('close-handle')).toBeLessThan(fs.events.indexOf('move'));
  expect(fs.events).toContain(`preview:${pdfUri}`);
  await expect(readCache(key, isRecord, 7)).resolves.toEqual({ uri: pdfUri });
  expect(mockApi).toHaveBeenCalledWith('/reports/pdf', expect.any(Function), { method: 'POST', body: { reading_id: 42 }, timeout: 180000 });
  expect(downloads).toHaveBeenCalledWith(signedUrl, expect.any(File), { idempotent: true });
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

it('discards a download completing after logout and never opens or caches it', async () => {
  const download = deferred<void>();
  downloads.mockImplementation(async (_url, destination) => {
    const file = destination as File; await file.write('%PDF-partial'); await download.promise; await file.write(validPdf); return file;
  });
  await pressPdf(); await waitFor(() => expect(downloads).toHaveBeenCalled());
  await act(async () => { clearPrivateCache(); download.resolve(); });
  await finished();
  expect(fs.files.size).toBe(0);
  expect(fs.events.some(event => event.startsWith('preview:'))).toBe(false);
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

it('preserves and opens the complete previous PDF when a new download fails partway through', async () => {
  await seedPdf();
  downloads.mockImplementation(async (_url, destination) => {
    await (destination as File).write('%PDF-partial'); throw new Error('Connection interrupted');
  });
  await pressPdf(); await finished();
  expect(fs.files.get(pdfUri)?.body).toBe(oldPdf);
  expect([...fs.files.keys()].some(uri => uri.endsWith('.part'))).toBe(false);
  expect(fs.events).toContain(`preview:${pdfUri}`);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('removes the saved PDF and refuses offline fallback after an explicit 403', async () => {
  await seedPdf(); mockApi.mockRejectedValue(new ApiError(403, 'Access revoked'));
  await pressPdf(); await finished();
  expect(screen.getByRole('alert').props.children).toBe('Access revoked');
  expect(fs.files.has(pdfUri)).toBe(false);
  expect(downloads).not.toHaveBeenCalled();
  expect(fs.events.some(event => event.startsWith('preview:'))).toBe(false);
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

it.each(['<html>Temporary storage failure</html>', '%PD'])('rejects an invalid or truncated PDF without caching or exporting it', async body => {
  downloads.mockImplementation(async (_url, destination) => {
    const file = destination as File; await file.write(body); return file;
  });
  await pressPdf(); await finished();
  expect(screen.getByRole('alert').props.children).toBe('Invalid PDF');
  expect(fs.files.size).toBe(0);
  expect(fs.events).toContain('close-handle');
  expect(fs.events).not.toContain('move');
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

it('keeps the valid previous PDF when its proposed replacement is invalid', async () => {
  await seedPdf();
  downloads.mockImplementation(async (_url, destination) => {
    const file = destination as File; await file.write('<html>Not a PDF</html>'); return file;
  });
  await pressPdf(); await finished();
  expect(fs.files.get(pdfUri)?.body).toBe(oldPdf);
  expect(fs.events).not.toContain('move');
  expect(fs.events).toContain(`preview:${pdfUri}`);
});

it.each([true, false])('does not open or export after logout while waiting for preview availability (%s)', async available => {
  const preview = deferred<boolean>();
  const capability = jest.fn<() => Promise<boolean>>(() => preview.promise);
  // The output object is constructed before the temporary file is moved. Capture
  // it through move so the pending native capability check uses that same object.
  const move = File.prototype.move;
  jest.spyOn(File.prototype, 'move').mockImplementation(async function (this: File, destination, options) {
    jest.mocked((destination as File).canPreview).mockImplementation(capability);
    return move.call(this, destination, options);
  });
  await pressPdf();
  await waitFor(() => expect(capability).toHaveBeenCalled());
  await act(async () => { clearPrivateCache(); preview.resolve(available); });
  await finished();
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  expect(fs.events.some(event => event.startsWith('preview:'))).toBe(false);
});
