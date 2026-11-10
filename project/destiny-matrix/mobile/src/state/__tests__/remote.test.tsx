import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { ApiError } from '../../native/http';
import { readCache, writeCache, dropCache, cacheGeneration } from '../../native/cache';
import { useRemote } from '../useRemote';

const mockApi = jest.fn<() => Promise<{ text: string }>>();
let mockApp = { base: 'https://example.org', locale: 'ru', session: { user: { id: 1 } }, ready: true, version: 0, api: mockApi, t: (ru: string) => ru };
jest.mock('../AppState', () => ({ useApp: () => mockApp }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../../native/cache', () => ({ cacheGeneration: jest.fn(() => 0), dropCache: jest.fn(), readCache: jest.fn<() => Promise<unknown>>(), writeCache: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) }));
let remote: ReturnType<typeof useRemote<{ text: string }>>;
const guard = (value: unknown): value is { text: string } => !!value && typeof (value as { text: string }).text === 'string';
function Probe() {
  const value = useRemote('/private-reading', guard, { private: true });
  useEffect(() => { remote = value; }, [value]); return null;
}
beforeEach(() => { jest.clearAllMocks(); mockApp = { ...mockApp, version: 0, session: { user: { id: 1 } } }; jest.mocked(cacheGeneration).mockReturnValue(0); jest.mocked(readCache).mockResolvedValue(null); jest.mocked(writeCache).mockResolvedValue(undefined); });
it.each([0, 429, 503])('uses owner-validated offline data on transient status %s', async status => {
  mockApi.mockRejectedValue(new ApiError(status, 'Unavailable')); jest.mocked(readCache).mockResolvedValue({ text: 'Saved reading' });
  await render(<Probe />); await waitFor(() => expect(remote.offline).toBe(true));
  expect(remote.data?.text).toBe('Saved reading'); expect(readCache).toHaveBeenCalledWith(expect.stringContaining('private-reading'), guard, 1);
  expect(dropCache).not.toHaveBeenCalled();
});
it.each([401, 402, 403, 404, 410])('removes a private reading on a confirmed denial %s', async status => {
  mockApi.mockRejectedValue(new ApiError(status, 'Denied'));
  await render(<Probe />); await waitFor(() => expect(remote.error).toBe('Denied'));
  expect(dropCache).toHaveBeenCalled(); expect(readCache).not.toHaveBeenCalled(); expect(remote.data).toBeUndefined();
});
it('does not display an old response after the account changes', async () => {
  let finish!: (value: { text: string }) => void;
  mockApi.mockImplementationOnce(() => new Promise(ok => { finish = ok; })).mockRejectedValue(new ApiError(503, 'Offline'));
  const view = await render(<Probe />); await waitFor(() => expect(finish).toBeDefined());
  mockApp = { ...mockApp, version: 1, session: { user: { id: 2 } } }; await view.rerender(<Probe />);
  await act(async () => finish({ text: 'Previous account private text' }));
  await waitFor(() => expect(remote.loading).toBe(false)); expect(remote.data).toBeUndefined();
  expect(writeCache).not.toHaveBeenCalled();
});
it('does not publish a response if access was revoked while its cache write completed', async () => {
  let finish!: () => void;
  mockApi.mockResolvedValue({ text: 'Private reading' }); jest.mocked(writeCache).mockImplementation(() => new Promise(ok => { finish = ok; }));
  await render(<Probe />); await waitFor(() => expect(finish).toBeDefined());
  jest.mocked(cacheGeneration).mockReturnValue(1); await act(async () => finish());
  expect(remote.data).toBeUndefined();
});
