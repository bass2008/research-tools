import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Confirm from '../../app/account/confirm';

let mockParams: { token?: string; kind?: string };
const mockApi = jest.fn<(...args: unknown[]) => Promise<Record<string, unknown>>>();
const mockLogout = jest.fn<() => Promise<void>>();
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ t: (_ru: string, en: string) => en,
  api: (...args: unknown[]) => mockApi(...args), logout: () => mockLogout(), setLocale: jest.fn() }) }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks(); mockApi.mockReset(); mockLogout.mockResolvedValue();
  mockParams = { kind: 'change_email', token: 'old-address-token' };
});

it('confirms both sequential email-change links when the router reuses the screen', async () => {
  mockApi.mockResolvedValueOnce({ changed: false }).mockResolvedValueOnce({ changed: true });
  const view = await render(<Confirm />);
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm address' }));
  await screen.findByText('Address confirmed. Confirmation of the other address is still required.');
  expect(mockLogout).not.toHaveBeenCalled();
  mockParams = { kind: 'change_email', token: 'new-address-token' };
  await view.rerender(<Confirm />);
  expect(screen.queryByText('Address confirmed. Confirmation of the other address is still required.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm address' }));
  await screen.findByText('Email changed. Sign in with the new address.');
  expect(mockApi.mock.calls.map(call => call[2])).toEqual([
    { method: 'POST', anonymous: true, body: { kind: 'change_email', token: 'old-address-token' } },
    { method: 'POST', anonymous: true, body: { kind: 'change_email', token: 'new-address-token' } },
  ]);
  expect(mockLogout).toHaveBeenCalledTimes(1);
});

it('resets the completed confirmation when the kind changes', async () => {
  mockApi.mockResolvedValue({ verified: true });
  mockParams = { kind: 'verify_email', token: 'token' };
  const view = await render(<Confirm />);
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm address' }));
  await screen.findByText('Email verified.');
  mockParams = { kind: 'change_email', token: 'token' };
  await view.rerender(<Confirm />);
  expect(screen.getByRole('button', { name: 'Confirm address' })).toBeTruthy();
  expect(screen.queryByText('Email verified.')).toBeNull();
});

it('does not apply a late response from the first link to the second link', async () => {
  let finishFirst!: (value: Record<string, unknown>) => void;
  mockApi.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
  const view = await render(<Confirm />);
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm address' }));
  await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1));
  mockParams = { kind: 'change_email', token: 'new-address-token' };
  await view.rerender(<Confirm />);
  await act(async () => { finishFirst({ changed: false }); });
  expect(screen.getByRole('button', { name: 'Confirm address' })).toBeTruthy();
  expect(screen.queryByText('Address confirmed. Confirmation of the other address is still required.')).toBeNull();
});
