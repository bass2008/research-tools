import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { DailyProvider, useDailySelection } from '../DailyProvider';
import { selectionForDate } from '../calendar';

const listeners = new Map<string, (state?: string) => void>();
const removals: ReturnType<typeof jest.fn>[] = [];
const originalState = AppState.currentState;
function Snapshot({ name }: { name: string }) {
  const day = useDailySelection();
  return <Text testID={name}>{`${day.dateKey}:${day.arcanum}`}</Text>;
}
function Consumers() {
  return <DailyProvider><Snapshot name="home" /><Snapshot name="reading" /></DailyProvider>;
}
const textFor = (now: Date) => { const value = selectionForDate(now); return `${value.dateKey}:${value.arcanum}`; };
function expectBoth(now: Date) {
  expect(screen.getByTestId('home').props.children).toBe(textFor(now));
  expect(screen.getByTestId('reading').props.children).toBe(textFor(now));
}

beforeEach(() => {
  // React's scheduler/microtasks are not the provider's midnight timeout.
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
  listeners.clear(); removals.length = 0;
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    listeners.set(event, listener as (state?: string) => void);
    const remove = jest.fn(() => { listeners.delete(event); });
    removals.push(remove);
    return { remove };
  });
});
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks(); jest.useRealTimers(); AppState.currentState = originalState;
});

it('updates both consumers at local midnight and schedules just one following refresh', async () => {
  jest.setSystemTime(new Date(2026, 10, 8, 23, 59, 59));
  await render(<Consumers />);
  expectBoth(new Date(2026, 10, 8, 12));
  await act(async () => { jest.advanceTimersByTime(1100); });
  expectBoth(new Date(2026, 10, 9, 12));
  expect(jest.getTimerCount()).toBe(1);
});

it('stops the background timer, catches up after several days, and reschedules after a clock change', async () => {
  jest.setSystemTime(new Date(2026, 10, 8, 12));
  await render(<Consumers />);
  await act(async () => { listeners.get('change')?.('background'); });
  expect(jest.getTimerCount()).toBe(0);
  jest.setSystemTime(new Date(2026, 10, 11, 9));
  expectBoth(new Date(2026, 10, 8, 12));
  await act(async () => { listeners.get('change')?.('active'); });
  expectBoth(new Date(2026, 10, 11, 9));
  expect(jest.getTimerCount()).toBe(1);
  jest.setSystemTime(new Date(2026, 10, 10, 23, 59, 59));
  await act(async () => { listeners.get('focus')?.(); });
  expectBoth(new Date(2026, 10, 10, 12));
  await act(async () => { jest.advanceTimersByTime(1100); });
  expectBoth(new Date(2026, 10, 11, 12));
  expect(jest.getTimerCount()).toBe(1);
});

it('does not accumulate timers on repeated focus and removes every subscription on unmount', async () => {
  jest.setSystemTime(new Date(2026, 10, 8, 12));
  const view = await render(<Consumers />);
  await act(async () => { for (let i = 0; i < 4; i++) listeners.get('focus')?.(); });
  expect(jest.getTimerCount()).toBe(1);
  await view.unmount();
  expect(jest.getTimerCount()).toBe(0);
  expect(listeners.size).toBe(0);
  expect(removals).toHaveLength(2);
  for (const remove of removals) expect(remove).toHaveBeenCalledTimes(1);
});

it('waits for resume when mounted in the background', async () => {
  AppState.currentState = 'background';
  jest.setSystemTime(new Date(2026, 10, 8, 12));
  await render(<Consumers />);
  expect(jest.getTimerCount()).toBe(0);
  jest.setSystemTime(new Date(2026, 10, 9, 12));
  await act(async () => { listeners.get('change')?.('active'); });
  expectBoth(new Date(2026, 10, 9, 12));
  expect(jest.getTimerCount()).toBe(1);
});
