import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { SectionOut } from '@/lib/publicSpec';
import { ChapterContents } from '../ChapterContents';
import { ChapterReader, LockedChapter } from '../ChapterReader';
import { usePersonalReport } from '../../state/usePersonalReport';
import { useReadingProgress } from '../../state/useReadingProgress';

let mockAllowed = true;
let mockLocale: 'ru' | 'en' = 'ru';
const mockPush = jest.fn();
const mockSetParams = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args), setParams: (...args: unknown[]) => mockSetParams(...args) } }));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: mockLocale,
  t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en }) }));
jest.mock('../../state/Billing', () => ({ useBilling: () => ({ canPurchase: mockAllowed, price: () => 'CHF 6.50' }) }));
jest.mock('../../state/usePersonalReport', () => ({ usePersonalReport: jest.fn() }));
jest.mock('../../state/useReadingProgress', () => ({ useReadingProgress: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
const free: SectionOut = { key: 'character', title: 'Character', access: 'free', lead: '',
  positions: [{ arcanum: 8, label: 'Public', href: '/encyclopedia/arcanum/8' }] };
const locked: SectionOut = { key: 'purpose', title: 'Purpose', access: 'paid', locked: true,
  lead: 'PRIVATE LEAD', teaser: 'Server teaser', positions: [
    { arcanum: 6, label: 'PRIVATE POSITION', text: 'PRIVATE TEXT', href: '/encyclopedia/arcanum/6' },
  ] };
beforeEach(() => { mockAllowed = true; mockLocale = 'ru'; jest.clearAllMocks(); });
it('keeps server order, position cards and read/locked states in compact contents', async () => {
  const select = jest.fn();
  await render(<ChapterContents sections={[free, locked]} readKeys={['character', 'purpose']} onSelect={select} />);
  expect(screen.getByText('Прочитана')).toBeTruthy();
  expect(screen.getByText('Закрыта')).toBeTruthy();
  expect(screen.getByTestId('arcanum-image-6')).toBeTruthy();
  expect(screen.queryByText(/PRIVATE/)).toBeNull();
  await fireEvent.press(screen.getByTestId('contents-purpose'));
  expect(select).toHaveBeenCalledWith('purpose');
});
it.each(['ru', 'en'] as const)('offers only the current date’s closed chapters with Billing price (%s)', async locale => {
  mockLocale = locale;
  await render(<LockedChapter section={locked} sections={[free, locked]} params={{ birth: '1989-09-21', sex: 'f' }} />);
  expect(screen.getByText('Server teaser')).toBeTruthy();
  expect(screen.queryByText(/PRIVATE/)).toBeNull();
  expect(screen.getByText(locale === 'ru' ? 'Откроются все закрытые главы · 1' : 'Unlock every locked chapter · 1')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('chapter-purchase'));
  expect(mockPush).toHaveBeenCalledWith('/purchase?product=single&chapter=purpose&birth=1989-09-21&sex=f');
});
it.each(['RU', 'unknown'])('hides prices and payment actions in %s', async () => {
  mockAllowed = false;
  await render(<LockedChapter section={locked} sections={[free, locked]} params={{ id: '42' }} />);
  expect(screen.queryByTestId('chapter-purchase')).toBeNull();
  expect(screen.queryByText(/CHF/)).toBeNull();
  expect(screen.getByText('Уже купленное — в кабинете')).toBeTruthy();
  expect(screen.queryByText(/PRIVATE/)).toBeNull();
});


it('marks an open chapter read on reaching its end without needing the Next action', async () => {
  const complete = jest.fn<(chapter: string) => Promise<void>>().mockResolvedValue();
  jest.mocked(useReadingProgress).mockReturnValue({ readKeys: [], complete,
    remember: jest.fn<() => Promise<void>>().mockResolvedValue() });
  jest.mocked(usePersonalReport).mockReturnValue({ sections: [free, locked], readerKey: 'fixture',
    calculation: null, saved: {}, remote: { loading: false, reload: jest.fn() },
  } as unknown as ReturnType<typeof usePersonalReport>);
  await render(<ChapterReader params={{ birth: '1989-09-21', chapter: 'character' }} />);
  await fireEvent(screen.getByTestId('chapter-end'), 'layout', { nativeEvent: { layout: { y: 1000 } } });
  let scroll = screen.getByTestId('chapter-end');
  while (scroll.parent && !scroll.props.onScroll) scroll = scroll.parent;
  await fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 400 }, layoutMeasurement: { height: 600 } } });
  expect(complete).not.toHaveBeenCalled();
  await fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 500 }, layoutMeasurement: { height: 600 } } });
  expect(complete).toHaveBeenCalledWith('character');
  await fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 510 }, layoutMeasurement: { height: 600 } } });
  expect(complete).toHaveBeenCalledTimes(1);
});

it('uses the bottom navigation for the next locked chapter and the illustrated contents', async () => {
  const complete = jest.fn<(chapter: string) => Promise<void>>().mockResolvedValue();
  jest.mocked(useReadingProgress).mockReturnValue({ readKeys: ['character'], complete,
    remember: jest.fn<() => Promise<void>>().mockResolvedValue() });
  jest.mocked(usePersonalReport).mockReturnValue({ sections: [free, locked], readerKey: 'fixture',
    calculation: null, saved: {}, remote: { loading: false, reload: jest.fn() },
  } as unknown as ReturnType<typeof usePersonalReport>);
  const view = await render(<ChapterReader params={{ birth: '1989-09-21', chapter: 'character' }} />);
  expect(screen.queryByTestId('chapter-contents-button')).toBeNull();
  expect(screen.getByTestId('reader-toolbar')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('reader-next'));
  expect(mockSetParams).toHaveBeenCalledWith({ chapter: 'purpose' });
  expect(complete).not.toHaveBeenCalled();
  await view.rerender(<ChapterReader params={{ birth: '1989-09-21', chapter: 'purpose' }} />);
  expect(screen.getByTestId('chapter-purpose')).toBeTruthy();
  expect(screen.getByText('Server teaser')).toBeTruthy();
  expect(screen.queryByText(/PRIVATE/)).toBeNull();
  expect(screen.queryByTestId('reader-next')).toBeNull();
  await fireEvent.press(screen.getByTestId('reader-contents'));
  expect(screen.getByTestId('contents-purpose').props.accessibilityState.selected).toBe(true);
  expect(screen.getByTestId('contents-character').props.accessibilityLabel).toContain('Прочитана');
  expect(screen.getByTestId('contents-purpose').props.accessibilityLabel).toContain('Закрыта');
  expect(screen.getByTestId('reader-contents-sheet')).toBeTruthy();
});
