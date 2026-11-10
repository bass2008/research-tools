import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { GoogleSignIn } from '../GoogleSignIn';
import { ApiError, type Guard } from '../../native/http';
import type { Session } from '../../native/contracts';

const mockApi = jest.fn<(path: string, options: Record<string, unknown>) => Promise<unknown>>();
const mockAuthenticated = jest.fn<(session: Session) => Promise<void>>();
const mockConfigure = jest.fn(), mockCheck = jest.fn<() => Promise<void>>(), mockSignOut = jest.fn<() => Promise<void>>();
const mockPresent = jest.fn<() => Promise<unknown>>(), mockButton = jest.fn(), mockPush = jest.fn();
let mockLocale: 'ru' | 'en' = 'ru';
const mockChallenge = { challenge: 'c'.repeat(43), nonce: 'n'.repeat(43), client_id: '123-client.apps.googleusercontent.com' };
const mockSession = { token: 'arcana-session-only', user: { id: 42, email: 'person@example.com' } };
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: mockLocale, setLocale: jest.fn(),
  t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en,
  api: async (path: string, guard: Guard<unknown>, options: Record<string, unknown>) => {
    const value = await mockApi(path, options);
    if (!guard(value)) {
      const { ApiError: ActualApiError } = jest.requireActual<typeof import('../../native/http')>('../../native/http');
      throw new ActualApiError(502, mockLocale === 'ru' ? 'Не удалось прочитать ответ.' : 'Unable to read the response.');
    }
    return value;
  },
}) }));
jest.mock('react-native-nitro-google-signin', () => ({
  GoogleOneTapSignIn: { configure: (...args: unknown[]) => mockConfigure(...args), checkPlayServices: () => mockCheck(),
    presentExplicitSignIn: () => mockPresent(), signOut: () => mockSignOut() },
  isErrorWithCode: (error: unknown) => !!error && typeof error === 'object' && 'code' in error,
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE' },
  GoogleSignInButton: (props: import('react-native-nitro-google-signin').GoogleSignInButtonProps) => {
    mockButton(props);
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Pressable testID={props.testID} accessibilityRole="button" accessibilityLabel={props.accessibilityLabel}
      accessibilityState={props.accessibilityState} disabled={props.disabled} onPress={props.onPress}><Text>Google</Text></Pressable>;
  },
}));

function Harness() {
  const lock = useRef(false); const [busy, setBusy] = useState(false);
  const run = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await operation(); } finally { lock.current = false; setBusy(false); }
  };
  return <GoogleSignIn disabled={busy} run={run} onAuthenticated={mockAuthenticated} forgotHref="/forgot?returnTo=%2Fpurchase%3Fproduct%3Dmonth" />;
}
const linkRequired = () => new ApiError(409, 'Confirm existing password', { code: 'google_link_required' });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const start = () => fireEvent.press(screen.getByTestId('google-sign-in'));
function nativePress() {
  const props = mockButton.mock.calls.at(-1)?.[0] as import('react-native-nitro-google-signin').GoogleSignInButtonProps;
  expect(typeof props.onPress).toBe('function');
  return () => Promise.resolve(props.onPress!());
}
beforeEach(() => {
  jest.clearAllMocks(); mockLocale = 'ru';
  mockCheck.mockResolvedValue(); mockSignOut.mockResolvedValue(); mockAuthenticated.mockResolvedValue();
  mockPresent.mockResolvedValue({ type: 'success', data: { idToken: 'native-google-id-token-private' } });
  mockApi.mockImplementation(async path => path.endsWith('/challenge') ? mockChallenge : mockSession);
});
afterEach(async () => { await cleanup(); jest.useRealTimers(); });

it('makes no startup request and authenticates only the checked Arcana response after explicit Google selection', async () => {
  await render(<Harness />);
  expect(mockApi).not.toHaveBeenCalled(); expect(mockConfigure).not.toHaveBeenCalled(); expect(mockPresent).not.toHaveBeenCalled();
  expect(mockButton).toHaveBeenLastCalledWith(expect.objectContaining({ signInBehavior: 'none', size: 'standard',
    style: { width: '100%', maxWidth: 230, height: 48, alignSelf: 'center' } }));
  await start();
  expect(mockApi).toHaveBeenNthCalledWith(1, '/mobile/auth/google/challenge', expect.objectContaining({ method: 'POST', anonymous: true, body: {} }));
  expect(mockConfigure).toHaveBeenCalledWith(expect.objectContaining({ webClientId: mockChallenge.client_id, nonce: mockChallenge.nonce, offlineAccess: false }));
  expect(mockApi).toHaveBeenNthCalledWith(2, '/mobile/auth/google', expect.objectContaining({ method: 'POST', anonymous: true,
    body: { credential: 'native-google-id-token-private', challenge: mockChallenge.challenge } }));
  expect(mockSignOut.mock.invocationCallOrder[0]).toBeLessThan(mockApi.mock.invocationCallOrder[1]);
  expect(mockAuthenticated).toHaveBeenCalledWith(mockSession);
});
it('treats cancel as benign, unlocks the button and never sends a Google credential to the backend', async () => {
  mockPresent.mockResolvedValue({ type: 'cancelled', data: null });
  await render(<Harness />); await start();
  expect(mockApi).toHaveBeenCalledTimes(1); expect(mockAuthenticated).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByTestId('google-sign-in').props.accessibilityState.disabled).toBe(false);
});
it.each(['ru', 'en'] as const)('offers email/password fallback for missing Google services in %s', async locale => {
  mockLocale = locale;
  mockCheck.mockRejectedValue({ code: 'PLAY_SERVICES_NOT_AVAILABLE', message: 'private SDK token stack' });
  await render(<Harness />); await start();
  expect(screen.getByRole('alert').props.children).toContain(locale === 'ru' ? 'почте и паролю' : 'email and password');
  expect(screen.queryByText(/private SDK/)).toBeNull(); expect(mockPresent).not.toHaveBeenCalled(); expect(mockAuthenticated).not.toHaveBeenCalled();
});
it('shows a localized unconfigured-server response before invoking the native SDK', async () => {
  mockApi.mockRejectedValue(new ApiError(503, 'Вход через Google пока недоступен.'));
  await render(<Harness />); await start();
  expect(screen.getByRole('alert').props.children).toBe('Вход через Google пока недоступен.');
  expect(mockConfigure).not.toHaveBeenCalled(); expect(mockAuthenticated).not.toHaveBeenCalled();
});
it.each(['challenge', 'session'])('rejects an invalid server %s response without creating an Arcana session', async kind => {
  mockApi.mockImplementation(async path => path.endsWith('/challenge') ? kind === 'challenge' ? { ...mockChallenge, nonce: '' } : mockChallenge
    : { user: { id: '42', email: 'person@example.com' } });
  await render(<Harness />); await start();
  expect(screen.getByRole('alert').props.children).toBe('Не удалось прочитать ответ.');
  expect(mockAuthenticated).not.toHaveBeenCalled();
  if (kind === 'challenge') expect(mockConfigure).not.toHaveBeenCalled();
});
it('keeps the same proof only in memory for password retries, and provides the contextual recovery link', async () => {
  mockApi.mockImplementation(async (path, options) => {
    if (path.endsWith('/challenge')) return mockChallenge;
    const body = options.body as Record<string, unknown>;
    if (!body.current_password) throw linkRequired();
    if (body.current_password === 'wrong') throw new ApiError(401, 'Текущий пароль неверен.');
    return mockSession;
  });
  await render(<Harness />); await start();
  expect(screen.getByTestId('google-link-confirmation')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('google-link-forgot'));
  expect(mockPush).toHaveBeenCalledWith('/forgot?returnTo=%2Fpurchase%3Fproduct%3Dmonth');
  await fireEvent.changeText(screen.getByTestId('google-link-password'), 'wrong');
  await fireEvent.press(screen.getByTestId('google-link-submit'));
  expect(screen.getByRole('alert').props.children).toBe('Текущий пароль неверен.');
  expect(screen.getByTestId('google-link-password').props.value).toBe('');
  await fireEvent.changeText(screen.getByTestId('google-link-password'), 'current-password');
  await fireEvent.press(screen.getByTestId('google-link-submit'));
  expect(mockApi).toHaveBeenLastCalledWith('/mobile/auth/google', expect.objectContaining({ body: {
    credential: 'native-google-id-token-private', challenge: mockChallenge.challenge, current_password: 'current-password',
  } }));
  expect(mockPresent).toHaveBeenCalledTimes(1); expect(mockAuthenticated).toHaveBeenCalledWith(mockSession);
  expect(screen.queryByTestId('google-link-password')).toBeNull();
});
it('clears pending proof on cancel and starts a new Google challenge for the next attempt', async () => {
  mockApi.mockImplementation(async path => { if (path.endsWith('/challenge')) return mockChallenge; throw linkRequired(); });
  await render(<Harness />); await start();
  await fireEvent.changeText(screen.getByTestId('google-link-password'), 'do-not-retain');
  await fireEvent.press(screen.getByTestId('google-link-cancel'));
  expect(screen.queryByTestId('google-link-password')).toBeNull(); expect(screen.queryByRole('alert')).toBeNull();
  mockPresent.mockResolvedValue({ type: 'cancelled', data: null });
  await start();
  expect(mockPresent).toHaveBeenCalledTimes(2);
  expect(mockApi.mock.calls.filter(([path]) => path.endsWith('/challenge'))).toHaveLength(2);
  expect(screen.queryByTestId('google-link-password')).toBeNull(); expect(mockAuthenticated).not.toHaveBeenCalled();
});
it('expires password proof after five minutes and removes the password field', async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-11-09T10:00:00Z'));
  mockApi.mockImplementation(async path => { if (path.endsWith('/challenge')) return mockChallenge; throw linkRequired(); });
  await render(<Harness />); await start();
  await fireEvent.changeText(screen.getByTestId('google-link-password'), 'do-not-retain');
  await act(async () => { jest.advanceTimersByTime(300_000); });
  expect(screen.queryByTestId('google-link-password')).toBeNull();
  expect(screen.getByRole('alert').props.children).toBe('Время подтверждения истекло. Нажмите Google ещё раз.');
  expect(mockApi).toHaveBeenCalledTimes(2); expect(mockAuthenticated).not.toHaveBeenCalled();
});
it('does not exchange a credential if the account picker took longer than the challenge lifetime', async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-11-09T10:00:00Z'));
  mockPresent.mockImplementation(async () => { jest.setSystemTime(new Date('2026-11-09T10:05:01Z')); return { type: 'success', data: { idToken: 'native-google-id-token-private' } }; });
  await render(<Harness />); await start();
  expect(mockApi).toHaveBeenCalledTimes(1); expect(mockAuthenticated).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').props.children).toContain('Время подтверждения истекло');
});
it('honors the parent lock for duplicate taps while the challenge request is pending', async () => {
  const pending = deferred<unknown>();
  mockApi.mockImplementation(path => path.endsWith('/challenge') ? pending.promise : Promise.resolve(mockSession));
  await render(<Harness />);
  const press = nativePress();
  let first!: Promise<void>, second!: Promise<void>;
  await act(async () => { first = press(); second = press(); });
  expect(mockApi).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(mockChallenge); await Promise.all([first, second]); });
  expect(mockPresent).toHaveBeenCalledTimes(1); expect(mockAuthenticated).toHaveBeenCalledTimes(1);
});
it('ignores a native picker result after unmount and still clears its native session', async () => {
  const pending = deferred<unknown>(); mockPresent.mockReturnValue(pending.promise);
  const view = await render(<Harness />); let operation!: Promise<void>;
  const press = nativePress();
  await act(async () => { operation = press(); });
  await view.unmount();
  await act(async () => { pending.resolve({ type: 'success', data: { idToken: 'native-google-id-token-private' } }); await operation; });
  expect(mockApi).toHaveBeenCalledTimes(1); expect(mockAuthenticated).not.toHaveBeenCalled(); expect(mockSignOut).toHaveBeenCalledTimes(1);
});
it('shows the server refusal for an unverified third-party Google email without retaining proof', async () => {
  mockApi.mockImplementation(async path => {
    if (path.endsWith('/challenge')) return mockChallenge;
    throw new ApiError(403, 'Подтвердите почту, затем подключите Google.', { code: 'google_email_verification_required' });
  });
  await render(<Harness />); await start();
  expect(screen.getByRole('alert').props.children).toBe('Подтвердите почту, затем подключите Google.');
  expect(screen.queryByTestId('google-link-password')).toBeNull(); expect(mockAuthenticated).not.toHaveBeenCalled();
});
it('shows a safe error if Arcana session storage fails after Google verification', async () => {
  mockAuthenticated.mockRejectedValue(new Error('private secure storage details'));
  await render(<Harness />); await start();
  expect(screen.getByRole('alert').props.children).toContain('Повторите или войдите по почте');
  expect(screen.queryByText(/private secure/)).toBeNull(); expect(screen.queryByTestId('google-link-password')).toBeNull();
});
