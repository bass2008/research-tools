import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { request, ApiError } from '../../native/http';
import { AppProvider, useApp } from '../AppState';
import { productAccess } from '../useProductAccess';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn<() => Promise<null>>().mockResolvedValue(null), setItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), deleteItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) }));
jest.mock('../../native/config', () => ({ config: { apiBase: 'https://example.org', local: false } }));
jest.mock('../../native/cache', () => ({ clearPrivateCache: jest.fn(), revokePrivateAccess: jest.fn() }));
jest.mock('../../native/http', () => ({ ...jest.requireActual<object>('../../native/http'), request: jest.fn() }));
let state: ReturnType<typeof useApp>;
function Probe() { const app = useApp(); useEffect(() => { state = app; }, [app]); return null; }
const session = (token: string) => ({ token, user: { id: 1, email: 'test@example.org' } });
beforeEach(() => { jest.clearAllMocks(); jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined); });
async function setup() { await render(<AppProvider><Probe /></AppProvider>); await waitFor(() => expect(state.ready).toBe(true)); }
it('an old request returning 401 cannot erase a freshly rotated session', async () => {
  await setup(); await act(() => state.authenticate(session('old')));
  let reject!: (reason: unknown) => void;
  jest.mocked(request).mockImplementationOnce(() => new Promise((_, no) => { reject = no; }));
  const pending = state.api('/auth/me', (v): v is object => !!v).catch(e => e);
  await act(() => state.authenticate(session('new')));
  await act(async () => { reject(new ApiError(401, 'Expired')); await pending; });
  expect(state.session?.token).toBe('new'); expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
it('a delayed successful response is rejected after logout', async () => {
  await setup(); await act(() => state.authenticate(session('old')));
  let resolve!: (value: unknown) => void;
  jest.mocked(request).mockImplementationOnce(<T,>() => new Promise<T>(ok => { resolve = value => ok(value as T); }));
  const pending = state.api('/auth/me', (v): v is object => !!v).catch(e => e);
  await act(() => state.logout()); resolve({ user: { id: 1 } });
  expect(await pending).toMatchObject({ status: 409 }); expect(state.session).toBeNull();
});
it('logout wins against an in-flight SecureStore write', async () => {
  await setup();
  let finish!: () => void;
  jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(() => new Promise<void>(ok => { finish = ok; }));
  const signingIn = state.authenticate(session('new'));
  await waitFor(() => expect(finish).toBeDefined());
  await act(async () => { const signingOut = state.logout(); finish(); await Promise.all([signingIn, signingOut]); });
  expect(state.session).toBeNull(); expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('arcana.session');
});
it('a long-lived single-reading grant cannot extend an expired subscription to other dates', () => {
  const expired = new Date(Date.now() - 1000).toISOString(), future = new Date(Date.now() + 999999).toISOString();
  expect(productAccess({ rights: [
    { products: ['personal'], per_reading: false, expires_at: expired },
    { products: ['personal'], per_reading: true, expires_at: future },
  ] }, 'personal').unlimited).toBe(false);
  expect(productAccess({ rights: [{ products: ['*'], per_reading: false, expires_at: null }] }, 'pair')).toEqual({ unlimited: true, until: null });
});
