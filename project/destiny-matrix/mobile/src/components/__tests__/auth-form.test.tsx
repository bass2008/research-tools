import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthForm } from '../AuthForm';
import { authHref } from '../../native/authReturn';
import { isSession, isUser, type Session } from '../../native/contracts';

let mockParams: Record<string, string>;
let mockGoogleSession: Session;
const mockPush = jest.fn(), mockDismissTo = jest.fn();
const mockApi = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockAuthenticate = jest.fn<(session: Session) => Promise<void>>();
const signedIn: Session = { token: 'arcana-session', user: { id: 7, email: 'member@gmail.com' } };
const target = '/purchase?product=pair&a=1987-06-14&b=1992-08-12';
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), dismissTo: (...args: unknown[]) => mockDismissTo(...args) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../../state/AppState', () => ({ useApp: () => ({
  locale: 'ru', t: (ru: string) => ru, api: mockApi, authenticate: mockAuthenticate, setLocale: jest.fn(),
}) }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('../GoogleSignIn', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return { GoogleSignIn: ({ disabled, run, onAuthenticated }: {
    disabled: boolean; run: (operation: () => Promise<void>) => Promise<void>;
    onAuthenticated: (session: Session) => Promise<void>;
  }) => React.createElement(Pressable, { testID: 'google-sign-in', disabled,
    onPress: () => run(() => onAuthenticated(mockGoogleSession)) }) };
});
beforeEach(() => {
  jest.clearAllMocks(); mockParams = { returnTo: target };
  mockGoogleSession = signedIn;
  mockApi.mockResolvedValue(signedIn); mockAuthenticate.mockResolvedValue();
});

it.each([false, true])('persists the Google session and respects restore-only=%s before navigation', async restoring => {
  if (restoring) mockGoogleSession = { ...signedIn, deletion: {
    requested_at: '2026-11-09T12:00:00Z', delete_at: '2026-12-09T12:00:00Z', renewal_cancellation: 'complete',
  } };
  await render(<AuthForm mode="login" />);
  await fireEvent.press(screen.getByTestId('google-sign-in'));
  await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith(restoring ? '/settings' : target));
  expect(mockAuthenticate).toHaveBeenCalledWith(mockGoogleSession);
  expect(mockApi).not.toHaveBeenCalled();
});

it.each(['login', 'register'] as const)('returns from %s to the selected pair after the session is persisted', async mode => {
  let persist!: () => void;
  mockAuthenticate.mockImplementationOnce(() => new Promise<void>(resolve => { persist = resolve; }));
  await render(<AuthForm mode={mode} />);
  await fireEvent.changeText(screen.getByTestId('auth-email'), 'member@gmail.com');
  await fireEvent.changeText(screen.getByTestId('auth-password'), 'correct-password');
  await fireEvent.press(screen.getByTestId('auth-submit'));
  expect(mockApi).toHaveBeenCalledWith(`/mobile/auth/${mode}`, expect.any(Function), {
    method: 'POST', anonymous: true, body: { email: 'member@gmail.com', password: 'correct-password' },
  });
  expect(mockDismissTo).not.toHaveBeenCalled();
  expect(screen.getByTestId('auth-submit').props.accessibilityState.disabled).toBe(true);
  await act(async () => persist());
  await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith(target));
  expect(mockApi).toHaveBeenCalledTimes(1);
});

it('preserves the intended destination when moving to registration or password recovery', async () => {
  await render(<AuthForm mode="login" />);
  await fireEvent.press(screen.getByRole('link', { name: 'Создать аккаунт' }));
  expect(mockPush).toHaveBeenLastCalledWith(authHref('register', target));
  await fireEvent.press(screen.getByRole('link', { name: 'Забыли пароль?' }));
  expect(mockPush).toHaveBeenLastCalledWith(authHref('forgot', target));
});

it('routes a restore-only session to account recovery even when purchase was requested', async () => {
  mockApi.mockResolvedValue({ ...signedIn, deletion: {
    requested_at: '2026-11-09T12:00:00Z', delete_at: '2026-12-09T12:00:00Z', renewal_cancellation: 'complete',
  } });
  await render(<AuthForm mode="login" />);
  await fireEvent.press(screen.getByTestId('auth-submit'));
  await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith('/settings'));
});

it('does not navigate or authenticate after a failed credential request', async () => {
  mockApi.mockRejectedValue(new Error('Неверный пароль'));
  await render(<AuthForm mode="login" />);
  await fireEvent.press(screen.getByTestId('auth-submit'));
  expect(await screen.findByText('Неверный пароль')).toBeTruthy();
  expect(mockAuthenticate).not.toHaveBeenCalled(); expect(mockDismissTo).not.toHaveBeenCalled();
});

it('ignores an external destination and falls back to the account', async () => {
  mockParams.returnTo = '//example.org/phishing';
  await render(<AuthForm mode="login" />);
  await fireEvent.press(screen.getByTestId('auth-submit'));
  await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith('/account'));
});

it('accepts existing sessions and validates the Google-only password capability', () => {
  expect(isSession(signedIn)).toBe(true);
  expect(isSession({ ...signedIn, user: { ...signedIn.user, has_password: false } })).toBe(true);
  expect(isSession({ ...signedIn, user: { ...signedIn.user, has_password: 'false' } })).toBe(false);
  expect(isUser({ user: { ...signedIn.user, has_password: 'false' }, access: {} })).toBe(false);
});
