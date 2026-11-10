import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Dimensions } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Purchase from '../../app/purchase';
import Settings from '../../app/settings';

const mockPurchase = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockRestore = jest.fn<() => Promise<void>>();
const mockNativeCrash = jest.fn();
const mockAccountApi = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockReload = jest.fn(), mockInvalidate = jest.fn(), mockPush = jest.fn(), mockReplace = jest.fn(), mockDismissTo = jest.fn();
let mockLocale: 'ru' | 'en' = 'ru';
let mockConfig = { local: false, errorsDsn: '', release: 'test' };
let mockParams: Record<string, string | string[]>;
let mockSession: Record<string, unknown> | null;
let mockReading: Record<string, unknown>;
let mockDeletion: Record<string, unknown>;
let mockRights: Record<string, unknown>;
let mockBilling: Record<string, unknown>;
jest.mock('expo-router', () => ({ router: { dismissTo: (...args: unknown[]) => mockDismissTo(...args), push: (...args: unknown[]) => mockPush(...args), replace: (...args: unknown[]) => mockReplace(...args) }, useLocalSearchParams: () => mockParams }));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ session: mockSession, locale: mockLocale, t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en,
  invalidateAccess: mockInvalidate, base: 'http://localhost', setLocale: jest.fn(), api: mockAccountApi }) }));
jest.mock('../../state/Billing', () => ({ useBilling: () => mockBilling }));
jest.mock('../../state/useReadingProgress', () => ({ useReadingProgress: () => ({ readKeys: [] }) }));
jest.mock('../../state/useProductAccess', () => ({ useProductAccess: () => mockRights }));
jest.mock('../../state/useRemote', () => ({ useRemote: (path: string | null) => path?.startsWith('/readings/') ? mockReading : path === '/mobile/account/deletion' ? mockDeletion : { loading: false, reload: mockReload } }));
jest.mock('../../native/config', () => ({ get config() { return mockConfig; } }));
jest.mock('../../native/errors', () => ({ sendErrorProbe: jest.fn(), sendNativeCrashProbe: () => mockNativeCrash() }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = 'ru';
  mockConfig = { local: false, errorsDsn: '', release: 'test' };
  mockParams = { id: '42', product: 'single' };
  mockSession = { user: { id: 1, email: 'test@example.org' }, token: 'test' };
  mockReading = { data: { id: 42, product: 'personal', access: 'locked' }, loading: false, reload: mockReload };
  mockDeletion = { loading: false, reload: mockReload };
  mockRights = { unlimited: false, loading: false };
  mockPurchase.mockResolvedValue(); mockRestore.mockResolvedValue();
  mockAccountApi.mockResolvedValue({ ok: true });
  mockBilling = { canPurchase: true, busy: false, receipt: null, purchase: mockPurchase, restore: mockRestore,
    price: () => '$5.00', status: { provider: 'google_play', subscriptions: [] } };
});

it.each(['ru', 'en'] as const)('lets a Google-only account establish a password before protected changes in %s', async locale => {
  mockLocale = locale;
  mockSession = { token: 'session', user: { id: 1, email: 'owner@gmail.com', has_password: false } };
  await render(<Settings />);
  expect(screen.queryByTestId('current-password')).toBeNull();
  expect(screen.queryByTestId('change-password')).toBeNull();
  expect(screen.getByTestId('delete-account').props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByTestId('set-account-password'));
  expect(mockAccountApi).toHaveBeenCalledWith('/auth/reset/request', expect.any(Function), {
    method: 'POST', anonymous: true, body: { email: 'owner@gmail.com' },
  });
  expect(screen.getByText(locale === 'ru' ? /Письмо со ссылкой для создания пароля отправлено/ : /A link to set your password has been sent/)).toBeTruthy();
  expect(mockAccountApi).toHaveBeenCalledTimes(1);
});

describe('purchase eligibility', () => {
  it.each(['ru', 'en'] as const)('shows the real subscription before sign-in without creating an order (%s)', async locale => {
    mockLocale = locale; mockSession = null; mockParams = { product: 'month' };
    mockBilling.price = () => 'CHF 11.75';
    const view = await render(<Purchase />);
    expect(screen.getByText(locale === 'ru' ? 'Все разборы на 3 месяца' : 'All readings for 3 months')).toBeTruthy();
    expect(screen.getByText('CHF 11.75')).toBeTruthy();
    expect(screen.getByText(locale === 'ru'
      ? 'CHF 11.75 каждые 3 месяца с автопродлением. Отмена в Google Play; доступ до конца оплаченного срока.'
      : 'Renews automatically at CHF 11.75 every 3 months. Cancel in Google Play; access lasts until the paid period ends.')).toBeTruthy();
    expect(screen.getByText(locale === 'ru' ? /Один аккаунт для сайта и приложения/ : /One account for the website and app/)).toBeTruthy();
    expect(screen.queryByText(locale === 'ru' ? /Индивидуальная работа автора/ : /A personal reading by an author/)).toBeNull();
    expect(screen.queryByTestId('buy-month')).toBeNull(); expect(screen.queryByTestId('restore-purchases')).toBeNull();
    expect(mockPurchase).not.toHaveBeenCalled(); expect(mockAccountApi).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('sign-in-month'));
    expect(mockPush).toHaveBeenCalledWith('/login?returnTo=%2Fpurchase%3Fproduct%3Dmonth');
    expect(mockPurchase).not.toHaveBeenCalled();
    mockSession = { user: { id: 1 }, token: 'test' };
    await view.rerender(<Purchase />);
    expect(screen.queryByTestId('sign-in-month')).toBeNull(); expect(mockPurchase).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('buy-month'));
    expect(mockPurchase).toHaveBeenCalledWith('month', {});
  });
  it.each(['RU', null])('keeps offers and payment links hidden for a guest in store country %s', async country => {
    mockSession = null; mockParams = { product: 'month' }; mockBilling.country = country; mockBilling.canPurchase = false;
    await render(<Purchase />);
    expect(screen.queryByTestId('sign-in-month')).toBeNull(); expect(screen.queryByTestId('buy-month')).toBeNull();
    expect(screen.queryByText('$5.00')).toBeNull(); expect(screen.queryByText(/купить на сайте|buy on.*website/i)).toBeNull();
    expect(mockPurchase).not.toHaveBeenCalled(); expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
  it('never substitutes a made-up price when the store has no offer', async () => {
    mockSession = null; mockParams = { product: 'month' }; mockBilling.price = () => null;
    await render(<Purchase />);
    expect(screen.queryByTestId('sign-in-month')).toBeNull(); expect(screen.queryByText('$5.00')).toBeNull();
    expect(mockPurchase).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
  });
  it('ignores a previous account receipt while a guest explores an offer', async () => {
    mockSession = null;
    mockBilling.receipt = { reading_id: 42, access: true, state: 'purchased' };
    await render(<Purchase />);
    expect(screen.queryByTestId('purchase-complete')).toBeNull();
    await fireEvent.press(screen.getByTestId('sign-in-single'));
    expect(mockPush).toHaveBeenCalledWith('/login?returnTo=%2Fpurchase%3Fproduct%3Dsingle%26id%3D42');
    expect(mockPurchase).not.toHaveBeenCalled();
  });
  it.each<{ name: string; params: Record<string, string | string[]> }>([
    { name: 'general subscription', params: { product: 'month' } },
    { name: 'empty checkout', params: {} },
    { name: 'personal reading without a date', params: { product: 'single', sex: 'f' } },
    { name: 'invalid calendar date', params: { product: 'single', birth: '1991-02-29', sex: 'f' } },
    { name: 'future date', params: { product: 'single', birth: '9999-01-01', sex: 'f' } },
    { name: 'date before calculator limit', params: { product: 'single', birth: '1899-12-31', sex: 'f' } },
    { name: 'non-ISO date', params: { product: 'single', birth: '12.08.1992', sex: 'f' } },
    { name: 'invalid sex', params: { product: 'single', birth: '1992-08-12', sex: 'invalid' } },
    { name: 'duplicate query values', params: { product: 'single', birth: ['1992-08-12', '1993-08-12'] } },
    { name: 'missing partner', params: { product: 'pair', a: '1992-08-12' } },
    { name: 'invalid partner date', params: { product: 'pair', a: '1992-08-12', b: '1990-02-30' } },
    { name: 'unknown product', params: { product: 'anything', birth: '1992-08-12', sex: 'f' } },
  ])('only sells a subscription for $name, without submitting invalid reading inputs', async ({ params }) => {
    mockParams = params;
    await render(<Purchase />);
    expect(screen.queryByTestId('buy-single')).toBeNull(); expect(screen.queryByTestId('buy-pair')).toBeNull();
    await fireEvent.press(screen.getByTestId('buy-month'));
    expect(mockPurchase.mock.calls).toEqual([['month', {}]]);
  });
  it('keeps a one-time option for a valid personal date from the subscription entry', async () => {
    mockParams = { product: 'month', birth: '1992-08-12' };
    await render(<Purchase />);
    expect(screen.getByTestId('buy-month')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('buy-single'));
    expect(mockPurchase).toHaveBeenCalledWith('single', { inputs: { birth: '1992-08-12', sex: 'f' } });
  });
  it('sends both validated unsaved dates when buying a couple reading', async () => {
    mockParams = { product: 'pair', a: '1992-08-12', b: '1990-02-28' };
    await render(<Purchase />); await fireEvent.press(screen.getByTestId('buy-pair'));
    expect(mockPurchase).toHaveBeenCalledWith('pair', { inputs: { a: { birth: '1992-08-12' }, b: { birth: '1990-02-28' } } });
  });
  it.each(['restricted-country', 'pending-deletion'])('does not offer a subscription at the general entry for %s', async reason => {
    mockParams = { product: 'month' };
    if (reason === 'restricted-country') mockBilling.canPurchase = false;
    else mockSession!.deletion = { delete_at: '2030-01-01T00:00:00Z' };
    await render(<Purchase />);
    expect(screen.queryByTestId('buy-month')).toBeNull(); expect(screen.queryByTestId('buy-single')).toBeNull();
    expect(mockPurchase).not.toHaveBeenCalled(); expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
  it.each(['rights', 'reading'])('waits for %s before offering a payment', async kind => {
    if (kind === 'rights') mockRights.loading = true; else mockReading.loading = true;
    await render(<Purchase />);
    expect(screen.queryByTestId('buy-single')).toBeNull(); expect(screen.queryByTestId('buy-month')).toBeNull();
    expect(screen.getByLabelText('Загрузка')).toBeTruthy();
  });
  it.each(['forever', 'granted', 'subscription', 'open'])('opens an already accessible saved reading (%s)', async access => {
    mockReading.data = { id: 42, product: 'personal', access };
    await render(<Purchase />);
    expect(screen.queryByTestId('buy-single')).toBeNull(); expect(screen.queryByTestId('buy-month')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Открыть разбор' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/reading/42');
  });
  it('does not offer purchases after a failed rights check and lets the user retry', async () => {
    mockReading.error = 'Server unavailable'; mockReading.data = undefined;
    await render(<Purchase />);
    expect(screen.queryByTestId('buy-single')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Повторить' }));
    expect(mockReload).toHaveBeenCalled(); expect(mockInvalidate).toHaveBeenCalled();
  });
  it.each(['bad-id', 'wrong-product'])('rejects an invalid saved-reading target (%s)', async kind => {
    if (kind === 'bad-id') mockParams.id = '-42'; else mockReading.data = { id: 42, product: 'pair', access: 'locked' };
    await render(<Purchase />);
    expect(screen.queryByTestId('buy-single')).toBeNull(); expect(screen.getByRole('alert')).toBeTruthy();
  });
  it('ignores a receipt for a different saved reading', async () => {
    mockBilling.receipt = { reading_id: 41, access: true, state: 'purchased' };
    await render(<Purchase />);
    expect(screen.getByTestId('buy-single')).toBeTruthy(); expect(screen.queryByText('Разбор открыт')).toBeNull();
  });
  it('does not offer another purchase while confirmation is pending', async () => {
    mockBilling.receipt = { reading_id: 42, access: false, state: 'pending' };
    await render(<Purchase />);
    expect(screen.queryByTestId('buy-single')).toBeNull(); expect(screen.queryByTestId('buy-month')).toBeNull();
    expect(screen.getByText('Ожидаем подтверждение оплаты')).toBeTruthy();
  });
  it('locks both offers while the first request is outstanding', async () => {
    let resolve!: () => void;
    mockPurchase.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    await render(<Purchase />);
    await fireEvent.press(screen.getByTestId('buy-single'));
    expect(screen.queryByTestId('buy-month')).toBeNull();
    expect(mockPurchase).toHaveBeenCalledTimes(1);
    expect(mockPurchase).toHaveBeenCalledWith('single', { reading_id: 42 });
    expect(screen.getByTestId('purchase-waiting')).toBeTruthy();
    await act(async () => { resolve(); });
    expect(screen.getByTestId('buy-month').props.accessibilityState.disabled).toBe(false);
  });
  it('buys two unsaved dates using the same SKU without showing the first receipt on the second checkout', async () => {
    mockParams = { product: 'single', birth: '1987-06-14', sex: 'f' };
    const view = await render(<Purchase />);
    await fireEvent.press(screen.getByTestId('buy-single'));
    mockBilling.receipt = { order_id: 'order-a', reading_id: 41, state: 'purchased', access: true };
    await view.rerender(<Purchase />);
    await fireEvent.press(screen.getByRole('button', { name: 'Открыть разбор' }));
    expect(mockDismissTo).toHaveBeenLastCalledWith('/reading/41');

    mockParams = { product: 'single', birth: '1990-02-15', sex: 'f' };
    await view.rerender(<Purchase />);
    expect(screen.getByTestId('buy-single')).toBeTruthy();
    expect(screen.queryByText('Разбор открыт')).toBeNull();
    let finish!: () => void;
    mockPurchase.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    await fireEvent.press(screen.getByTestId('buy-single'));
    // The provider can still expose the previous result while it starts the new request.
    expect(screen.queryByText('Разбор открыт')).toBeNull();
    expect(screen.queryByTestId('purchase-read')).toBeNull();
    mockBilling.receipt = { order_id: 'order-b', reading_id: 42, state: 'purchased', access: true };
    await act(async () => { finish(); });
    await view.rerender(<Purchase />);
    await fireEvent.press(screen.getByRole('button', { name: 'Открыть разбор' }));
    expect(mockDismissTo).toHaveBeenLastCalledWith('/reading/42');
    expect(mockPurchase.mock.calls).toEqual([
      ['single', { inputs: { birth: '1987-06-14', sex: 'f' } }],
      ['single', { inputs: { birth: '1990-02-15', sex: 'f' } }],
    ]);
  });
  it.each(['product', 'birth', 'sex', 'a', 'b'])('drops an initiated checkout receipt when %s changes', async field => {
    mockParams = { product: 'single', birth: '1987-06-14', sex: 'f', a: '1980-01-01', b: '1990-01-01' };
    const view = await render(<Purchase />);
    await fireEvent.press(screen.getByTestId('buy-single'));
    mockBilling.receipt = { order_id: 'order-a', reading_id: 41, state: 'purchased', access: true };
    await view.rerender(<Purchase />);
    expect(screen.getByTestId('purchase-complete')).toBeTruthy();
    mockParams = { ...mockParams, [field]: field === 'product' ? 'pair' : field === 'sex' ? 'm' : '1995-03-04' };
    await view.rerender(<Purchase />);
    expect(screen.queryByText('Разбор открыт')).toBeNull();
    expect(screen.getByTestId(`buy-${mockParams.product}`)).toBeTruthy();
  });
  it.each([true, false])('only shows a subscription receipt initiated from this checkout (saved=%s)', async saved => {
    if (!saved) mockParams = { product: 'single', birth: '1987-06-14', sex: 'f' };
    mockBilling.receipt = { order_id: 'old-subscription', reading_id: null, state: 'purchased', access: true };
    const view = await render(<Purchase />);
    expect(screen.getByTestId('buy-month')).toBeTruthy();
    expect(screen.queryByText('Разбор открыт')).toBeNull();
    await fireEvent.press(screen.getByTestId('buy-month'));
    expect(screen.queryByText('Разбор открыт')).toBeNull();
    mockBilling.receipt = { order_id: 'new-subscription', reading_id: null, state: 'purchased', access: true };
    await view.rerender(<Purchase />);
    expect(screen.getByText('Подписка активна')).toBeTruthy();
    mockParams = saved ? { ...mockParams, id: '43' } : { ...mockParams, birth: '1990-02-15' };
    await view.rerender(<Purchase />);
    expect(screen.queryByText('Разбор открыт')).toBeNull();
  });
});

describe('purchase completion', () => {
  const receipt = (changes: Record<string, unknown> = {}) => ({ order_id: 'new-order', reading_id: 42, state: 'purchased', access: true,
    expires_at: null, auto_renewing: false, finalized: true, ...changes });
  it.each([undefined, '1991-02-29'])('opens the account after a general subscription without a valid date (%s)', async birth => {
    mockParams = { product: 'month', ...(birth ? { birth } : {}) };
    const view = await render(<Purchase />); await fireEvent.press(screen.getByTestId('buy-month'));
    mockBilling.receipt = receipt({ reading_id: null, expires_at: '2030-02-14T12:00:00Z', auto_renewing: true });
    await view.rerender(<Purchase />);
    expect(screen.getByText('Подписка активна')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('purchase-read'));
    expect(mockDismissTo).toHaveBeenCalledWith('/account');
  });
  it.each(['single', 'pair'])('shows one reading action and no payment clutter after %s succeeds', async product => {
    mockParams.product = product;
    mockReading.data = { id: 42, product: product === 'pair' ? 'pair' : 'personal', access: 'locked' };
    mockBilling.receipt = receipt(); mockBilling.error = 'Previous store error';
    await render(<Purchase />);
    expect(screen.getByTestId('purchase-complete')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByTestId('buy-month')).toBeNull(); expect(screen.queryByTestId('restore-purchases')).toBeNull();
    expect(screen.queryByText('Previous store error')).toBeNull(); expect(screen.queryByText('Условия')).toBeNull();
    expect(screen.getByText('Доступ без ограничения срока')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('purchase-read'));
    expect(mockDismissTo).toHaveBeenCalledWith('/reading/42'); expect(mockPush).not.toHaveBeenCalled();
  });
  it.each(['single', 'pair'])('opens the current unsaved %s after a subscription and shows its actual deadline', async product => {
    mockLocale = 'en';
    mockParams = product === 'pair' ? { product, a: '1987-06-14', b: '1990-02-15' } : { product, birth: '1987-06-14', sex: 'f' };
    const view = await render(<Purchase />); await fireEvent.press(screen.getByTestId('buy-month'));
    mockBilling.receipt = receipt({ reading_id: null, expires_at: '2030-02-14T12:00:00Z', auto_renewing: true });
    await view.rerender(<Purchase />);
    expect(screen.getByText('Your subscription is active')).toBeTruthy();
    expect(screen.getByText('Access until 14 February 2030')).toBeTruthy();
    expect(screen.queryByText('Access with no expiry')).toBeNull();
    expect(screen.getByText('Auto-renewal is on. Manage your subscription in Google Play.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('purchase-read'));
    expect(mockDismissTo).toHaveBeenCalledWith(product === 'pair' ? '/compatibility?a=1987-06-14&b=1990-02-15' : '/report?birth=1987-06-14&sex=f');
  });
  it('keeps the full confirmation and action accessible at a large system font size', async () => {
    const previous = Dimensions.get('window');
    await act(async () => Dimensions.set({ window: { ...previous, width: 320, fontScale: 2 } }));
    try {
      mockBilling.receipt = receipt(); await render(<Purchase />);
      const title = screen.getByText('Разбор открыт');
      expect(title.props.numberOfLines).toBeUndefined(); expect(title.props.allowFontScaling).not.toBe(false);
      expect(screen.getByRole('button', { name: 'Открыть разбор' })).toBeTruthy();
      expect(screen.getByText('PDF можно открыть и сохранить из разбора').props.numberOfLines).toBeUndefined();
    } finally { await act(async () => Dimensions.set({ window: previous })); }
  });
  it('makes an unfinished payment explicit and permits a check without starting another payment', async () => {
    mockBilling.receipt = receipt({ state: 'pending', access: false, finalized: false });
    await render(<Purchase />);
    expect(screen.getByText('Повторно оплачивать не нужно.')).toBeTruthy();
    expect(screen.queryByTestId('buy-single')).toBeNull();
    await fireEvent.press(screen.getByTestId('restore-purchases'));
    expect(mockRestore).toHaveBeenCalledTimes(1); expect(mockPurchase).not.toHaveBeenCalled();
    expect(screen.getByText('Ожидаем подтверждение оплаты')).toBeTruthy();
  });
  it('shows restore progress then a truthful result without claiming that an empty restore unlocked a reading', async () => {
    let finish!: () => void;
    mockRestore.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    await render(<Purchase />); await fireEvent.press(screen.getByTestId('restore-purchases'));
    expect(screen.getByText('Проверяем покупки')).toBeTruthy(); expect(screen.queryByTestId('buy-single')).toBeNull();
    await act(async () => finish());
    expect(screen.getByText('Покупки проверены')).toBeTruthy(); expect(screen.queryByTestId('purchase-complete')).toBeNull();
    await fireEvent.press(screen.getByTestId('restore-open-account')); expect(mockReplace).toHaveBeenCalledWith('/account');
  });
  it('opens the full result when restore refreshes access to the current reading', async () => {
    const view = await render(<Purchase />); await fireEvent.press(screen.getByTestId('restore-purchases'));
    mockReading.data = { id: 42, product: 'personal', access: 'forever' }; await view.rerender(<Purchase />);
    expect(screen.getByTestId('purchase-complete')).toBeTruthy(); expect(screen.queryByTestId('restore-open-account')).toBeNull();
    await fireEvent.press(screen.getByTestId('purchase-read')); expect(mockDismissTo).toHaveBeenCalledWith('/reading/42');
  });
  it('offers a clear retry after restore fails and removes the failure after a successful retry', async () => {
    mockRestore.mockRejectedValueOnce(new Error('Network unavailable'));
    await render(<Purchase />); await fireEvent.press(screen.getByTestId('restore-purchases'));
    expect(screen.getByRole('alert').props.children).toBe('Network unavailable');
    await fireEvent.press(screen.getByRole('button', { name: 'Повторить проверку' }));
    expect(mockRestore).toHaveBeenCalledTimes(2); expect(screen.getByText('Покупки проверены')).toBeTruthy();
    expect(screen.queryByText('Network unavailable')).toBeNull();
  });
  it('keeps restore available when new purchases are unavailable', async () => {
    mockBilling.canPurchase = false;
    await render(<Purchase />); expect(screen.queryByTestId('buy-single')).toBeNull();
    await fireEvent.press(screen.getByTestId('restore-purchases')); expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Покупки проверены')).toBeTruthy();
  });
  it('explains a failed purchase and lets the user verify payment without immediately charging again', async () => {
    mockPurchase.mockRejectedValueOnce(new Error('Store unavailable'));
    await render(<Purchase />); await fireEvent.press(screen.getByTestId('buy-single'));
    expect(screen.getByRole('alert').props.children).toBe('Store unavailable');
    await fireEvent.press(screen.getByRole('button', { name: 'Проверить покупки' }));
    expect(mockRestore).toHaveBeenCalledTimes(1); expect(mockPurchase).toHaveBeenCalledTimes(1);
  });
  it('does not label general unlimited access as an active paid subscription', async () => {
    mockRights = { unlimited: true, until: null, loading: false };
    await render(<Purchase />);
    expect(screen.getByText('Разборы уже доступны')).toBeTruthy(); expect(screen.queryByText('Подписка активна')).toBeNull();
  });
});

describe('shared account deletion', () => {
  it('offers Google management while cancellation is pending, even after normal login is revoked', async () => {
    mockSession!.deletion = { delete_at: '2030-01-01T00:00:00Z', renewal_cancellation: 'complete' };
    mockDeletion.data = { deletion: { renewal_cancellation: 'pending' } };
    mockBilling.status = null;
    await render(<Settings />);
    expect(screen.getByText(/Удаляется общий аккаунт сайта и приложения/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('deletion-manage-subscription'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions?sku=month&package=com.arcanasense.app');
  });
  it('uses the refreshed cancellation status over the login snapshot', async () => {
    mockSession!.deletion = { delete_at: '2030-01-01T00:00:00Z', renewal_cancellation: 'pending' };
    mockDeletion.data = { deletion: { renewal_cancellation: 'complete' } };
    await render(<Settings />);
    expect(screen.queryByTestId('deletion-manage-subscription')).toBeNull();
    expect(screen.getByText('Автопродление отключено.')).toBeTruthy();
  });
  it('explains the shared website and app account before confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<Settings />);
    expect(screen.getByText(/Удаляется общий аккаунт сайта и приложения/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('delete-account'));
    expect(alert.mock.calls[0][1]).toContain('Удаляется общий аккаунт сайта и приложения');
    alert.mockRestore();
  });
  it('requires explicit confirmation before the local native crash probe', async () => {
    mockConfig = { local: true, errorsDsn: 'https://public@example.org/1', release: 'test' };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<Settings />);
    await fireEvent.press(screen.getByTestId('native-error-probe'));
    expect(mockNativeCrash).not.toHaveBeenCalled();
    expect(alert.mock.calls[0][1]).toContain('Приложение закроется');
    alert.mock.calls[0][2]?.find(button => button.style === 'destructive')?.onPress?.();
    expect(mockNativeCrash).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
  it('hides the destructive native crash probe from release builds', async () => {
    mockConfig.errorsDsn = 'https://public@example.org/1';
    await render(<Settings />);
    expect(screen.queryByTestId('native-error-probe')).toBeNull();
  });
});


it('returns from a confirmed purchase to the chapter that prompted it', async () => {
  mockParams = { product: 'single', id: '42', chapter: 'purpose' };
  mockBilling.receipt = { order_id: 'chapter-order', reading_id: 42, state: 'purchased', access: true,
    expires_at: null, auto_renewing: false, finalized: true };
  await render(<Purchase />);
  await fireEvent.press(screen.getByTestId('purchase-read'));
  expect(mockDismissTo).toHaveBeenCalledWith('/encyclopedia/reading?chapter=purpose&id=42');
});
