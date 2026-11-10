import { beforeEach, expect, it, jest } from '@jest/globals';
import { clearGoogleSession, isGoogleChallenge, NativeGoogleError, requestGoogleCredential } from '../googleSignIn';

const mockConfigure = jest.fn(), mockCheck = jest.fn<() => Promise<void>>();
const mockPresent = jest.fn<() => Promise<unknown>>(), mockSignOut = jest.fn<() => Promise<void>>();
jest.mock('react-native-nitro-google-signin', () => ({
  GoogleOneTapSignIn: { configure: (...args: unknown[]) => mockConfigure(...args), checkPlayServices: () => mockCheck(),
    presentExplicitSignIn: () => mockPresent(), signOut: () => mockSignOut() },
  isErrorWithCode: (error: unknown) => !!error && typeof error === 'object' && 'code' in error,
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE' },
}));
const challenge = { challenge: 'c'.repeat(43), nonce: 'n'.repeat(43), client_id: '123-client.apps.googleusercontent.com' };
beforeEach(() => {
  jest.clearAllMocks(); mockCheck.mockResolvedValue(); mockSignOut.mockResolvedValue();
  mockPresent.mockResolvedValue({ type: 'success', data: { idToken: 'google-token-for-server-only' } });
});

it('forwards the exact server nonce to explicit sign-in and clears the app SDK session before returning its token', async () => {
  expect(await requestGoogleCredential(challenge)).toBe('google-token-for-server-only');
  expect(mockConfigure).toHaveBeenCalledWith({ webClientId: challenge.client_id, nonce: challenge.nonce, offlineAccess: false, autoSelectOnSignIn: false });
  expect(mockCheck).toHaveBeenCalledTimes(1); expect(mockPresent).toHaveBeenCalledTimes(1); expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockCheck.mock.invocationCallOrder[0]).toBeLessThan(mockPresent.mock.invocationCallOrder[0]);
  expect(mockPresent.mock.invocationCallOrder[0]).toBeLessThan(mockSignOut.mock.invocationCallOrder[0]);
});
it.each(['response', 'exception'])('treats a Google cancellation (%s) as a benign empty result', async kind => {
  if (kind === 'response') mockPresent.mockResolvedValue({ type: 'cancelled', data: null });
  else mockPresent.mockRejectedValue({ code: 'SIGN_IN_CANCELLED', message: 'private native detail' });
  expect(await requestGoogleCredential(challenge)).toBeNull();
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});
it('classifies absent Play Services without opening sign-in or exposing its native message', async () => {
  mockCheck.mockRejectedValue({ code: 'PLAY_SERVICES_NOT_AVAILABLE', message: 'native private details' });
  await expect(requestGoogleCredential(challenge)).rejects.toMatchObject({ reason: 'unavailable', message: 'Google sign-in could not be completed' });
  expect(mockPresent).not.toHaveBeenCalled(); expect(mockSignOut).toHaveBeenCalledTimes(1);
});
it.each([
  { type: 'noSavedCredentialFound', data: null }, { type: 'success', data: null },
  { type: 'success', data: { idToken: '' } }, { type: 'success', data: { idToken: 'a'.repeat(8193) } },
])('rejects a native response without a bounded ID token: %p', async result => {
  mockPresent.mockResolvedValue(result);
  await expect(requestGoogleCredential(challenge)).rejects.toBeInstanceOf(NativeGoogleError);
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});
it('sanitizes unknown native errors and tolerates SDK cleanup failure', async () => {
  mockPresent.mockRejectedValue(new Error('private token and native stack'));
  mockSignOut.mockRejectedValue(new Error('cleanup stack'));
  await expect(requestGoogleCredential(challenge)).rejects.toMatchObject({ reason: 'failed', message: 'Google sign-in could not be completed' });
  await expect(clearGoogleSession()).resolves.toBeUndefined();
});
it('requires a bounded server challenge, nonce and explicit Google web client ID', () => {
  expect(isGoogleChallenge(challenge)).toBe(true);
  for (const input of [null, {}, { ...challenge, nonce: '' }, { ...challenge, challenge: ['value'] },
    { ...challenge, nonce: 'a'.repeat(44) }, { ...challenge, client_id: 'autoDetect' },
    { ...challenge, client_id: 'https://attacker.invalid' }]) expect(isGoogleChallenge(input)).toBe(false);
});
