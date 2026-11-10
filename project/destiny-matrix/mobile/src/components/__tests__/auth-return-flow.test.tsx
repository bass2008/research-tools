import { beforeEach, expect, it, jest } from '@jest/globals';
import type { ComponentType } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Purchase from '../../app/purchase';
import Report from '../../app/report';
import Reading from '../../app/reading/[id]';
import Compatibility from '../../app/(tabs)/compatibility';
import { safeAuthReturn } from '../../native/authReturn';

const mockPush = jest.fn(), mockReplace = jest.fn(), mockPurchase = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockApi = jest.fn<(...args: unknown[]) => Promise<{ id: number }>>();
const mockReload = jest.fn(), mockInvalidate = jest.fn();
let mockParams: Record<string, string | string[]> = {};
let mockSession: { user: { id: number } } | null = null;
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => mockParams, useFocusEffect: jest.fn(), Redirect: () => null,
}));
jest.mock('../../state/AppState', () => ({ useApp: () => ({
  session: mockSession, locale: 'ru', t: (ru: string) => ru, invalidateAccess: mockInvalidate,
  base: 'http://localhost', setLocale: jest.fn(), api: mockApi,
}) }));
jest.mock('../../state/Billing', () => ({ useBilling: () => ({
  canPurchase: true, busy: false, receipt: null, purchase: mockPurchase, restore: jest.fn(),
  price: () => '$5.00', status: { provider: 'google_play', subscriptions: [] },
}) }));
jest.mock('../../state/useProductAccess', () => ({ useProductAccess: () => ({ unlimited: false, loading: false }) }));
jest.mock('../../state/useRemote', () => ({ useRemote: () => ({ loading: false, reload: mockReload }) }));
jest.mock('../../native/config', () => ({ config: { local: false } }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
// Chart geometry is covered separately; keep its real dates visible while testing
// the actual calculator, reading, auth links and purchase actions together.
jest.mock('../ChartCover', () => ({ ChartCover: ({ dates }: { dates: string[] }) => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return <Text testID="chart-dates">{dates.join(' / ')}</Text>;
} }));
jest.mock('../MatrixMap', () => ({ MatrixMap: () => null }));

beforeEach(() => {
  jest.clearAllMocks(); mockParams = {}; mockSession = null;
  mockApi.mockResolvedValue({ id: 54 }); mockPurchase.mockResolvedValue();
});

function returnFromLastLink() {
  const href = mockPush.mock.calls.at(-1)?.[0];
  expect(typeof href).toBe('string');
  const url = new URL(String(href), 'https://native.invalid');
  expect(url.pathname).toBe('/login');
  return safeAuthReturn(url.searchParams.get('returnTo'));
}

it('lets a guest calculate a couple, then restores both dates after login and waits for explicit Save', async () => {
  const guest = await render(<Compatibility />);
  for (const [prefix, day, month, year] of [['partner-a', '14', '06', '1987'], ['partner-b', '27', '05', '1999']]) {
    await fireEvent.changeText(screen.getByTestId(`${prefix}-day`), day);
    await fireEvent.changeText(screen.getByTestId(`${prefix}-month`), month);
    await fireEvent.changeText(screen.getByTestId(`${prefix}-year`), year);
  }
  await fireEvent.press(screen.getByTestId('calculate-pair'));
  const datesBeforeLogin = screen.getByTestId('chart-dates').props.children;
  expect(mockPush).not.toHaveBeenCalled(); expect(mockApi).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('save-pair-auth'));
  const target = returnFromLastLink();
  expect(target).toBe('/compatibility?a=1987-06-14&b=1999-05-27');
  await guest.unmount();
  mockSession = { user: { id: 1 } };
  mockParams = Object.fromEntries(new URL(target, 'https://native.invalid').searchParams);
  await render(<Compatibility />);
  expect(screen.getByTestId('chart-dates').props.children).toBe(datesBeforeLogin);
  expect(mockApi).not.toHaveBeenCalled(); expect(mockPurchase).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('save-pair'));
  expect(mockApi).toHaveBeenCalledWith('/readings', expect.any(Function), { method: 'POST', body: {
    product: 'pair', inputs: { a: { birth: '1987-06-14' }, b: { birth: '1999-05-27' } }, title: '',
  } });
  expect(mockPush).toHaveBeenLastCalledWith('/reading/54');
});

it('restores the personal birth date and sex before an explicit save', async () => {
  mockParams = { birth: '1987-06-14', sex: 'm' };
  const guest = await render(<Report />);
  await fireEvent.press(screen.getByTestId('save-reading-auth'));
  const target = returnFromLastLink();
  expect(target).toBe('/report?birth=1987-06-14&sex=m');
  await guest.unmount();
  mockSession = { user: { id: 1 } };
  mockParams = Object.fromEntries(new URL(target, 'https://native.invalid').searchParams);
  await render(<Report />);
  expect(mockApi).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('save-reading'));
  expect(mockApi).toHaveBeenCalledWith('/readings', expect.any(Function), { method: 'POST', body: {
    product: 'personal', inputs: { birth: '1987-06-14', sex: 'm' }, title: '',
  } });
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/report', params: { id: 54 } });
});

it('returns to the selected couple offer without purchasing on login', async () => {
  mockParams = { product: 'pair', a: '1987-06-14', b: '1999-05-27' };
  const view = await render(<Purchase />);
  expect(screen.queryByTestId('buy-pair')).toBeNull();
  expect(screen.getByText('Полный разбор этой пары')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('sign-in-pair'));
  const target = returnFromLastLink();
  expect(target).toBe('/purchase?product=pair&a=1987-06-14&b=1999-05-27');
  mockSession = { user: { id: 1 } };
  mockParams = Object.fromEntries(new URL(target, 'https://native.invalid').searchParams);
  await view.rerender(<Purchase />);
  expect(screen.getByTestId('buy-pair')).toBeTruthy();
  expect(mockPurchase).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('buy-pair'));
  expect(mockPurchase).toHaveBeenCalledWith('pair', { inputs: { a: { birth: '1987-06-14' }, b: { birth: '1999-05-27' } } });
});

it.each<{ name: string; Component: ComponentType; params: Record<string, string>; link: string; target: string }>([
  { name: 'personal saved reading', Component: Report, params: { id: '42' }, link: 'report-auth', target: '/report?id=42' },
  { name: 'couple saved reading', Component: Reading, params: { id: '81' }, link: 'reading-auth', target: '/reading/81' },
  { name: 'saved purchase offer', Component: Purchase, params: { id: '81', product: 'pair' }, link: 'sign-in-pair', target: '/purchase?product=pair&id=81' },
  { name: 'personal purchase offer', Component: Purchase, params: { birth: '1987-06-14', sex: 'm', product: 'single' }, link: 'sign-in-single', target: '/purchase?product=single&birth=1987-06-14&sex=m' },
  { name: 'general subscription', Component: Purchase, params: { product: 'month' }, link: 'sign-in-month', target: '/purchase?product=month' },
])('keeps the selected $name through its actual sign-in action', async ({ Component, params, link, target }) => {
  mockParams = params;
  await render(<Component />);
  await fireEvent.press(screen.getByTestId(link));
  expect(returnFromLastLink()).toBe(target);
  expect(mockPurchase).not.toHaveBeenCalled(); expect(mockApi).not.toHaveBeenCalled();
});
