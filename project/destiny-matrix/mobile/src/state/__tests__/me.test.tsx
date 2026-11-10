import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { MeProvider, useMe } from '../Me';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
  setItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
let state: ReturnType<typeof useMe>;
function Probe() { const value = useMe(); useEffect(() => { state = value; }, [value]); return null; }
beforeEach(() => { jest.clearAllMocks(); });
it('persists date and sex and restores them after a fresh mount', async () => {
  const first = await render(<MeProvider><Probe /></MeProvider>);
  await waitFor(() => expect(state.ready).toBe(true));
  const value = { birth: '1987-06-14', sex: 'm' as const };
  await act(() => state.saveMe(value));
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('arcana.me', JSON.stringify(value));
  await first.unmount();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(value));
  await render(<MeProvider><Probe /></MeProvider>);
  await waitFor(() => expect(state.me).toEqual(value));
});
it('does not replace my date when writing fails and ignores corrupt stored dates', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('{"birth":"2000-02-31","sex":"f"}');
  await render(<MeProvider><Probe /></MeProvider>);
  await waitFor(() => expect(state.ready).toBe(true));
  expect(state.me).toBeNull();
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('No storage'));
  await act(async () => {
    await expect(state.saveMe({ birth: '1987-06-14', sex: 'f' })).rejects.toThrow('No storage');
  });
  expect(state.me).toBeNull();
});
