import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { OfferIntro, PurchaseOffer } from '../PurchaseOffer';

let mockLocale: 'ru' | 'en' = 'ru';
const mockBuy = jest.fn<() => Promise<void>>();
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en }) }));

beforeEach(() => { mockBuy.mockReset(); mockBuy.mockResolvedValue(); });

describe('subscription offer', () => {
  it.each(['ru', 'en'] as const)('keeps the store price, three-month renewal terms and single purchase action explicit (%s)', async locale => {
  mockLocale = locale;
    await render(<><OfferIntro /><PurchaseOffer sku="month" price="CHF 11.75" busy={false} onPress={mockBuy} /></>);
    const title = screen.getByText(locale === 'ru' ? 'Все разборы на 3 месяца' : 'All readings for 3 months');
    expect(title.props.numberOfLines).toBeUndefined(); expect(title.props.allowFontScaling).not.toBe(false);
    expect(screen.getByText('CHF 11.75')).toBeTruthy();
    expect(screen.getByText(locale === 'ru' ? '/ 3 месяца' : '/ 3 months')).toBeTruthy();
    expect(screen.getByText(locale === 'ru' ? 'Подписка · автоматические разборы' : 'Subscription · automatic readings')).toBeTruthy();
    const terms = screen.getByText(locale === 'ru'
      ? 'CHF 11.75 каждые 3 месяца с автопродлением. Отмена в Google Play; доступ до конца оплаченного срока.'
      : 'Renews automatically at CHF 11.75 every 3 months. Cancel in Google Play; access lasts until the paid period ends.');
    expect(terms.props.numberOfLines).toBeUndefined(); expect(terms.props.allowFontScaling).not.toBe(false);
    expect(screen.queryByText(/навсегда|lifetime/i)).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: locale === 'ru' ? 'Оформить подписку · CHF 11.75' : 'Subscribe · CHF 11.75' }));
    expect(mockBuy).toHaveBeenCalledTimes(1);
  });
  it('keeps payment disabled while a transaction is in progress', async () => {
  mockLocale = 'en';
    await render(<PurchaseOffer sku="month" price="CHF 11.75" busy onPress={mockBuy} />);
    const button = screen.getByRole('button', { name: 'Subscribe · CHF 11.75' });
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(button);
    expect(mockBuy).not.toHaveBeenCalled();
  });
  it.each(['ru', 'en'] as const)('presents the same priced offer with an explicit sign-in step for guests (%s)', async locale => {
  mockLocale = locale;
    await render(<PurchaseOffer sku="month" price="CHF 11.75" busy={false} requiresSignIn onPress={mockBuy} />);
    expect(screen.getByText('CHF 11.75')).toBeTruthy();
    expect(screen.getByText(locale === 'ru' ? /каждые 3 месяца с автопродлением/ : /Renews automatically.*every 3 months/)).toBeTruthy();
    expect(screen.queryByTestId('buy-month')).toBeNull();
    const action = screen.getByRole('button', { name: locale === 'ru' ? 'Войти для подписки · CHF 11.75' : 'Sign in to subscribe · CHF 11.75' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(action.props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(action); expect(mockBuy).toHaveBeenCalledTimes(1);
  });
});

it.each(['single', 'pair'] as const)('keeps %s a one-time purchase without subscription terms', async sku => {
  mockLocale = 'en';
  await render(<PurchaseOffer sku={sku} price="CHF 6.50" busy={false} onPress={mockBuy} />);
  expect(screen.getByText(sku === 'pair' ? 'Full reading for this couple' : 'Full reading for this date')).toBeTruthy();
  expect(screen.getByText('One-time purchase with lifetime access.')).toBeTruthy();
  expect(screen.queryByText(/Renews automatically/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Buy this reading · CHF 6.50' }));
  expect(mockBuy).toHaveBeenCalledTimes(1);
});
