import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { Lang } from '@/lib/i18n/hosts';
import type { SectionOut } from '@/lib/publicSpec';
import Calculator from '../../app/calculate';
import Account from '../../app/(tabs)/account';
import NotFound from '../../app/+not-found';
import { AuthForm } from '../AuthForm';
import { Article } from '../Article';
import { ReadingSection, CorpusParagraph } from '../ReadingSections';

jest.mock('../../state/Me', () => ({ useMe: () => ({ me: { birth: '1990-01-01', sex: 'f' }, saveMe: jest.fn() }) }));
let mockLocale: Lang = 'ru';
let mockSession: { user: { id: number; email: string } } | null = null;
const mockPush = jest.fn(), mockReplace = jest.fn(), mockApi = jest.fn<(...args: unknown[]) => Promise<unknown>>(), mockAuthenticate = jest.fn();
let mockRemote: Record<string, unknown> = { loading: false, reload: jest.fn() };
jest.mock('expo-router', () => ({ router: { dismissTo: (...args: unknown[]) => mockReplace(...args), push: (...args: unknown[]) => mockPush(...args), replace: (...args: unknown[]) => mockReplace(...args) }, useLocalSearchParams: () => ({}) }));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: mockLocale, t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en,
  api: mockApi, authenticate: mockAuthenticate, session: mockSession }) }));
jest.mock('../../state/useRemote', () => ({ useRemote: () => mockRemote }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
// The native Google surface has its own tests; these cover email and reading screens.
jest.mock('../GoogleSignIn', () => ({ GoogleSignIn: () => null }));

beforeEach(() => { mockLocale = 'ru'; mockSession = null; jest.clearAllMocks(); mockRemote = { loading: false, reload: jest.fn() }; });
it('keeps a date while changing language and calculates with the shared engine', async () => {
  const view = await render(<Calculator />);
  await fireEvent.changeText(screen.getByTestId('birth-day'), '14');
  await fireEvent.changeText(screen.getByTestId('birth-month'), '6');
  await fireEvent.changeText(screen.getByTestId('birth-year'), '1987');
  mockLocale = 'en'; await view.rerender(<Calculator />);
  expect(screen.getByDisplayValue('1987')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('calculate'));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: '/report', params: { birth: '1987-06-14', sex: 'f' } }));
});
it('rejects an impossible date before navigating', async () => {
  await render(<Calculator />);
  for (const [field, value] of [['day', '31'], ['month', '02'], ['year', '2000']]) await fireEvent.changeText(screen.getByTestId(`birth-${field}`), value);
  await fireEvent.press(screen.getByTestId('calculate'));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(mockPush).not.toHaveBeenCalled();
});
it.each(['ru', 'en'] as Lang[])('a locked section never renders its supplied private text (%s)', async locale => {
  mockLocale = locale;
  const section: SectionOut = { key: 'money', title: 'Money', lead: 'PRIVATE LEAD', access: 'paid', locked: true,
    positions: [{ label: 'Test', arcanum: 5, href: '/encyclopedia/arcanum/5', text: 'PRIVATE TEXT' }] };
  await render(<ReadingSection section={section} />);
  await fireEvent.press(screen.getByTestId('section-money'));
  expect(screen.queryByText('PRIVATE TEXT')).toBeNull(); expect(screen.queryByText('PRIVATE LEAD')).toBeNull();
});
it('preserves structured report paragraphs instead of silently dropping list and heading blocks', async () => {
  await render(<><CorpusParagraph paragraph={{ h3: 'Tail heading' }} /><CorpusParagraph paragraph={{ ul: ['First practice', 'Second practice'] }} /></>);
  expect(screen.getByText('Tail heading')).toBeTruthy(); expect(screen.getByText('• Second practice')).toBeTruthy();
});
it('starts date input from an empty account and the not-found calculator link', async () => {
  mockLocale = 'en'; mockSession = { user: { id: 1, email: 'reader@example.org' } };
  mockRemote = { loading: false, reload: jest.fn(), data: { user: mockSession.user, items: [] } };
  const account = await render(<Account />);
  await fireEvent.press(screen.getByRole('button', { name: 'Calculate my chart' }));
  expect(mockPush).toHaveBeenLastCalledWith('/calculate');
  await account.unmount(); mockPush.mockClear();
  await render(<NotFound />);
  await fireEvent.press(screen.getByRole('link', { name: 'Calculator' }));
  expect(mockPush).toHaveBeenLastCalledWith('/calculate');
});
it('keeps reading calculator and pair slots pointed at their own input forms', async () => {
  await render(<><CorpusParagraph paragraph={{ slot: 'calc' }} /><CorpusParagraph paragraph={{ slot: 'pair' }} /></>);
  await fireEvent.press(screen.getByRole('link', { name: '→' }));
  expect(mockPush).toHaveBeenLastCalledWith('/calculate');
  await fireEvent.press(screen.getByRole('link', { name: '↗' }));
  expect(mockPush).toHaveBeenLastCalledWith('/compatibility');
});
describe('authentication', () => {
  it.each(['ru', 'en'] as Lang[])('shows a failed sign-in without accepting a token (%s)', async locale => {
    mockLocale = locale; mockApi.mockRejectedValue(new Error('Invalid credentials'));
    await render(<AuthForm mode="login" />);
    await fireEvent.changeText(screen.getByTestId('auth-email'), 'tester@example.org');
    await fireEvent.changeText(screen.getByTestId('auth-password'), 'incorrect');
    await fireEvent.press(screen.getByTestId('auth-submit'));
    await screen.findByText('Invalid credentials'); expect(mockAuthenticate).not.toHaveBeenCalled();
  });
  it('stores the returned token and opens the account, with cookie-less credentials', async () => {
    const response = { token: 'new-token', user: { id: 1, email: 'test@example.org' } };
    mockApi.mockResolvedValue(response); await render(<AuthForm mode="login" />);
    await fireEvent.press(screen.getByTestId('auth-submit'));
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledWith(response));
    expect(mockApi.mock.calls[0][2]).toMatchObject({ anonymous: true });
    expect(mockReplace).toHaveBeenCalledWith('/account');
  });
  it('does not submit a password reset without an email token', async () => {
    await render(<AuthForm mode="reset" />);
    expect(screen.queryByTestId('auth-submit')).toBeNull(); expect(mockApi).not.toHaveBeenCalled();
  });
});
it.each(['ru', 'en'] as Lang[])('article reader exposes loading, retry and offline states (%s)', async locale => {
  mockLocale = locale; mockRemote = { loading: true, reload: jest.fn() };
  const view = await render(<Article path="/encyclopedia" />);
  expect(screen.getByLabelText(locale === 'ru' ? 'Загрузка' : 'Loading')).toBeTruthy();
  expect(screen.getByTestId('design-library')).toBeTruthy();
  expect(screen.queryByTestId('library-offline-demo')).toBeNull();
  mockRemote = { loading: false, error: 'Server unavailable', reload: jest.fn() }; await view.rerender(<Article path="/encyclopedia" />);
  expect(screen.queryByTestId('library-offline-daily')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: locale === 'ru' ? 'Повторить' : 'Retry' }));
  expect(mockRemote.reload).toHaveBeenCalled();
  mockRemote = { loading: false, offline: true, reload: jest.fn(), data: { title: 'Offline article', lead: '', breadcrumbs: [], access: 'public',
    blocks: [{ type: 'paragraph', text: 'Saved text' }, { type: 'heading', text: 'Saved heading', level: 2 }] } };
  await view.rerender(<Article path="/encyclopedia/arcanum/5" />);
  expect(screen.getByText('Saved text')).toBeTruthy(); expect(screen.getByText('Saved heading')).toBeTruthy();
});
