import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { SectionOut } from '@/lib/publicSpec';
import { forLocale as mockMatrixForLocale } from '@/lib/matrix';
import { pointsOf as mockPointsOf } from '@/lib/pair/engine';
import { monthPoints, yearMatrix } from '@/lib/yearMatrix';
import Home from '../../app/(tabs)/index';
import Today from '../../app/encyclopedia/today';
import { DailyProvider } from '../DailyProvider';
import { selectionForDate } from '../calendar';
import { dailyContent } from '../content';
import { dailyRelatedSection } from '../relatedSection';

let mockLocale: 'ru' | 'en' = 'ru';
let mockMe: { birth: string; sex: 'f' } | null = null;
let mockSections: SectionOut[] = [];
const mockNavigate = jest.fn(), mockSave = jest.fn<(...args: unknown[]) => Promise<void>>();
const now = new Date(2026, 10, 9, 12);
const selected = selectionForDate(now);
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockNavigate(...args),
    navigate: (...args: unknown[]) => mockNavigate(...args),
    replace: (...args: unknown[]) => mockNavigate(...args) },
  useFocusEffect: jest.fn(),
}));
jest.mock('../../state/Me', () => ({ useMe: () => ({ me: mockMe, saveMe: mockSave }) }));
jest.mock('../../state/useMyReading', () => ({ useMyReading: () => ({
  me: mockMe, sections: mockSections, readerKey: 'test',
  points: mockMe ? mockPointsOf(mockMatrixForLocale(mockLocale).calculate(mockMe.birth, mockMe.sex)) : {},
}) }));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: mockLocale,
  t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en, session: null,
}) }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks(); mockLocale = 'ru'; mockMe = null; mockSections = [];
  mockSave.mockResolvedValue(undefined);
  jest.useFakeTimers(); jest.setSystemTime(now);
});
afterEach(async () => { await cleanup(); jest.useRealTimers(); });

it('starts with one form and saves my date before opening the matrix', async () => {
  await render(<DailyProvider><Home /></DailyProvider>);
  expect(screen.queryByTestId('daily-theme')).toBeNull();
  expect(screen.queryByTestId('home-appearance')).toBeNull();
  for (const [field, value] of [['day', '14'], ['month', '6'], ['year', '1987']]) {
    await fireEvent.changeText(screen.getByTestId(`birth-${field}`), value);
  }
  await fireEvent.press(screen.getByTestId('calculate'));
  expect(mockSave).toHaveBeenCalledWith({ birth: '1987-06-14', sex: 'f' });
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/matrix', params: { point: '', chapter: '', selection: expect.any(String) } });
});

it.each(['ru', 'en'] as const)('shows my month and year and keeps the daily material in %s', async locale => {
  mockLocale = locale; mockMe = { birth: '1987-06-14', sex: 'f' };
  const view = await render(<DailyProvider><Home /></DailyProvider>);
  const theme = within(screen.getByTestId('daily-theme'));
  expect(theme.getByText(dailyContent(locale, selected.arcanum).question)).toBeTruthy();
  const monthly = monthPoints({ y: 1987, m: 6, d: 14 }, 2026, 11).E;
  expect(within(screen.getByTestId('today-month')).getByTestId(`arcanum-image-${monthly}`)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('today-year'));
  expect(mockNavigate).toHaveBeenLastCalledWith(`/article?path=${encodeURIComponent(`/year/${yearMatrix({ y: 1987, m: 6, d: 14 }, 2026).centre}`)}`);
  await fireEvent.press(screen.getByTestId('open-daily-theme'));
  expect(mockNavigate).toHaveBeenLastCalledWith('/encyclopedia/today');
  await view.rerender(<DailyProvider><Today /></DailyProvider>);
  expect(screen.queryByTestId('daily-open-demo')).toBeNull();
  expect(screen.queryByTestId('daily-open-my-chapter')).toBeNull();
  for (const paragraph of dailyContent(locale, selected.arcanum).paragraphs) {
    expect(screen.getByText(paragraph)).toBeTruthy();
  }
});

it('offers only an available personal chapter and hides it when access is revoked', async () => {
  mockMe = { birth: '1987-06-14', sex: 'f' };
  const related = dailyRelatedSection('ru', selected.arcanum);
  mockSections = [{ key: related.key, title: 'Моя глава', lead: '', access: 'free', positions: [] }];
  const view = await render(<DailyProvider><Today /></DailyProvider>);
  await fireEvent.press(screen.getByTestId('daily-open-my-chapter'));
  expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(`/matrix?chapter=${related.key}`));
  mockSections = [{ ...mockSections[0], locked: true }];
  await view.rerender(<DailyProvider><Today /></DailyProvider>);
  expect(screen.queryByTestId('daily-open-my-chapter')).toBeNull();
});


it('puts the personal point button inside the daily card and opens its matrix sheet', async () => {
  mockMe = { birth: '1987-06-14', sex: 'f' };
  await render(<DailyProvider><Home /></DailyProvider>);
  const theme = within(screen.getByTestId('daily-theme'));
  const button = theme.getByTestId('daily-matrix-point');
  expect(button.props.accessibilityRole).toBe('button');
  await fireEvent.press(button);
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/matrix', params: {
    point: expect.any(String), chapter: '', selection: expect.any(String),
  } });
});
