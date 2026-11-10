import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PermissionsAndroid, Platform, Pressable, Text } from 'react-native';
import { ReminderProvider, useReminder } from '../Reminder';
import { dailyNative, defaultReminder } from '../../native/dailyNative';

jest.mock('../../native/dailyNative', () => {
  const defaults = { enabled: false, hour: 9, minute: 0, locale: 'ru' };
  return { defaultReminder: defaults, dailyNative: {
    configure: jest.fn<() => Promise<typeof defaults>>().mockResolvedValue(defaults),
    setReminder: jest.fn(async (enabled: boolean, hour: number, minute: number) => ({ ...defaults, enabled, hour, minute })),
  } };
});
jest.mock('../../daily/DailyWidget', () => ({ updateDailyWidget: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) }));
jest.mock('../AppState', () => ({ useApp: () => ({ locale: 'ru', ready: true }) }));
jest.mock('../Me', () => ({ useMe: () => ({ me: null, ready: true }) }));

function Harness() {
  const { state, change, ready } = useReminder();
  return <>
    <Text>{ready ? 'ready' : 'loading'}</Text><Text>{state.enabled ? 'on' : 'off'}</Text>
    <Pressable testID="enable" onPress={() => change(true)} />
    <Pressable testID="disable" onPress={() => change(false)} />
    <Pressable testID="time" onPress={() => change(state.enabled, 8, 30)} />
  </>;
}

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  Object.defineProperty(Platform, 'Version', { get: () => 35, configurable: true });
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  jest.mocked(dailyNative!.configure).mockResolvedValue(defaultReminder);
});

it('starts off, and editing time while off does not ask permission or enable it', async () => {
  await render(<ReminderProvider><Harness /></ReminderProvider>);
  await waitFor(() => expect(screen.getByText('ready')).toBeTruthy());
  expect(screen.getByText('off')).toBeTruthy();
  expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('time'));
  await waitFor(() => expect(dailyNative!.setReminder).toHaveBeenCalledWith(false, 8, 30));
  expect(PermissionsAndroid.request).not.toHaveBeenCalled();
});

it('asks only on enable, persists the choice, and cancels without asking again', async () => {
  await render(<ReminderProvider><Harness /></ReminderProvider>);
  await waitFor(() => expect(screen.getByText('ready')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('enable'));
  await waitFor(() => expect(screen.getByText('on')).toBeTruthy());
  expect(PermissionsAndroid.request).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByTestId('disable'));
  await waitFor(() => expect(screen.getByText('off')).toBeTruthy());
  expect(dailyNative!.setReminder).toHaveBeenLastCalledWith(false, 9, 0);
  expect(PermissionsAndroid.request).toHaveBeenCalledTimes(1);
});

it('does not schedule a reminder when permission is denied', async () => {
  jest.mocked(PermissionsAndroid.request).mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
  await render(<ReminderProvider><Harness /></ReminderProvider>);
  await waitFor(() => expect(screen.getByText('ready')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('enable'));
  expect(dailyNative!.setReminder).not.toHaveBeenCalled();
  expect(screen.getByText('off')).toBeTruthy();
});
