import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ApiError } from '../../native/http';
import { cacheGeneration, dropCache, readCache, writeCache } from '../../native/cache';
import { useRemote } from '../useRemote';

interface Reading { text: string; until: string | null }
const mockApi = jest.fn<() => Promise<Reading>>();
const mockMount = jest.fn();
let mockApp = { base: 'https://example.org', locale: 'ru', session: { user: { id: 1 } }, ready: true, version: 0, api: mockApi, t: (ru: string) => ru };
jest.mock('../AppState', () => ({ useApp: () => mockApp }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../../native/cache', () => ({ cacheGeneration: jest.fn(() => 0), dropCache: jest.fn(), readCache: jest.fn<() => Promise<unknown>>(), writeCache: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) }));
const guard = (value: unknown): value is Reading => !!value && typeof (value as Reading).text === 'string';
let remote: ReturnType<typeof useRemote<Reading>>;
function Reader({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { mockMount(); }, []);
  return <Pressable accessibilityRole="button" accessibilityLabel="Section" onPress={() => setOpen(true)}><Text>{text}</Text>{open && <Text>Expanded section</Text>}</Pressable>;
}
function Probe({ path = '/reading/1', privateContent = true }: { path?: string; privateContent?: boolean }) {
  const value = useRemote(path, guard, { private: privateContent,
    grant: privateContent ? reading => ({ userId: mockApp.session.user.id, until: reading.until }) : undefined });
  useEffect(() => { remote = value; }, [value]);
  return value.data ? <Reader text={value.data.text} /> : <Text>Empty reader</Text>;
}
function pending() {
  let resolve!: (value: Reading) => void, reject!: (error: Error) => void;
  const promise = new Promise<Reading>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const first: Reading = { text: 'Loaded reading', until: null };
beforeEach(() => {
  jest.clearAllMocks(); mockApi.mockReset(); mockApp = { ...mockApp, version: 0, session: { user: { id: 1 } } };
  jest.mocked(cacheGeneration).mockReturnValue(0); jest.mocked(readCache).mockResolvedValue(null); jest.mocked(writeCache).mockResolvedValue(undefined);
});
afterEach(() => { jest.useRealTimers(); });

it.each([true, false])('keeps the same mounted reader and open section during refresh (private=%s)', async privateContent => {
  const next = pending(); mockApi.mockResolvedValueOnce(first).mockReturnValueOnce(next.promise);
  await render(<Probe privateContent={privateContent} />); await waitFor(() => expect(remote.data).toEqual(first));
  await fireEvent.press(screen.getByRole('button', { name: 'Section' }));
  await act(async () => remote.reload()); await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Expanded section')).toBeTruthy(); expect(remote.loading).toBe(false);
  await act(async () => next.resolve({ text: 'Refreshed reading', until: null }));
  expect(screen.getByText('Refreshed reading')).toBeTruthy(); expect(screen.getByText('Expanded section')).toBeTruthy();
  expect(mockMount).toHaveBeenCalledTimes(1);
});

it.each(['path', 'owner'] as const)('immediately hides the prior data after changing its %s', async changed => {
  mockApi.mockResolvedValueOnce(first).mockReturnValue(pending().promise);
  const view = await render(<Probe />); await waitFor(() => expect(remote.data).toEqual(first));
  if (changed === 'owner') mockApp = { ...mockApp, version: 1, session: { user: { id: 2 } } };
  await view.rerender(<Probe path={changed === 'path' ? '/reading/2' : '/reading/1'} />);
  expect(screen.queryByText('Loaded reading')).toBeNull(); expect(remote.data).toBeUndefined();
});

it.each([401, 402, 403, 404, 410])('clears retained text as soon as the refresh confirms denial %s', async status => {
  const next = pending(); mockApi.mockResolvedValueOnce(first).mockReturnValueOnce(next.promise);
  await render(<Probe />); await waitFor(() => expect(remote.data).toEqual(first));
  await act(async () => remote.reload()); await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Loaded reading')).toBeTruthy();
  await act(async () => next.reject(new ApiError(status, 'Denied')));
  expect(screen.queryByText('Loaded reading')).toBeNull(); expect(remote.error).toBe('Denied');
  expect(dropCache).toHaveBeenCalled(); expect(readCache).not.toHaveBeenCalled();
});

it('does not retain or revive a reading revoked while a refresh is pending', async () => {
  const next = pending(); mockApi.mockResolvedValueOnce(first).mockReturnValueOnce(next.promise).mockReturnValue(pending().promise);
  const view = await render(<Probe />); await waitFor(() => expect(remote.data).toEqual(first));
  await act(async () => remote.reload()); await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
  jest.mocked(cacheGeneration).mockReturnValue(1); mockApp = { ...mockApp, version: 1 }; await view.rerender(<Probe />);
  expect(screen.queryByText('Loaded reading')).toBeNull();
  await act(async () => next.resolve(first)); expect(remote.data).toBeUndefined();
  expect(writeCache).toHaveBeenCalledTimes(1);
});

it('hides subscription text exactly at its known expiry while the network request is pending', async () => {
  jest.useFakeTimers(); const now = Date.now(), next = pending();
  const reading = { ...first, until: new Date(now + 1000).toISOString() };
  mockApi.mockResolvedValueOnce(reading).mockReturnValueOnce(next.promise).mockReturnValue(pending().promise);
  await render(<Probe />); await waitFor(() => expect(remote.data).toEqual(reading));
  await act(async () => remote.reload()); await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
  await act(async () => jest.advanceTimersByTime(999)); expect(screen.getByText('Loaded reading')).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(1)); expect(screen.queryByText('Loaded reading')).toBeNull();
  await act(async () => next.resolve(reading)); expect(remote.data).toBeUndefined();
  expect(writeCache).toHaveBeenCalledTimes(1);
});

it('keeps a still-authorized in-memory reader after a transient failure when disk cache is unavailable', async () => {
  mockApi.mockResolvedValueOnce(first).mockRejectedValueOnce(new ApiError(503, 'Offline'));
  await render(<Probe />); await waitFor(() => expect(remote.data).toEqual(first));
  await fireEvent.press(screen.getByRole('button', { name: 'Section' }));
  await act(async () => remote.reload()); await waitFor(() => expect(remote.offline).toBe(true));
  expect(screen.getByText('Expanded section')).toBeTruthy(); expect(mockMount).toHaveBeenCalledTimes(1);
});

it('rejects a response whose grant expires during its cache write', async () => {
  jest.useFakeTimers(); let finish!: () => void;
  mockApi.mockResolvedValue({ ...first, until: new Date(Date.now() + 1000).toISOString() });
  jest.mocked(writeCache).mockImplementationOnce(() => new Promise<void>(ok => { finish = ok; }));
  await render(<Probe />); await waitFor(() => expect(finish).toBeDefined());
  await act(async () => jest.advanceTimersByTime(1000)); await act(async () => finish());
  expect(remote.data).toBeUndefined(); expect(remote.error).toBe('Срок доступа истёк'); expect(dropCache).toHaveBeenCalled();
});
