import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, type KeyboardEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance as MockScrollViewInstance } from 'react-native';
import type { SectionOut } from '@/lib/publicSpec';
import { ReaderAnchor, ReaderContentsButton, ReaderPage, ReaderSectionEnd, useReaderSections } from '../ReaderNavigation';
import { ReadingSection } from '../ReadingSections';
import { PairReading } from '../PairReading';
import type { PageProps } from '../ui';
import { readerPosition } from '../../native/readerPosition';
import type { Grant } from '../../native/cache';

let mockLocale: 'ru' | 'en' = 'en';
let mockSession: { user: { id: number }; deletion?: object } | null = null;
let mockEpoch = 0;
const mockPositions = new Map<string, unknown>();
const mockRead = jest.fn<(key: string) => Promise<unknown>>(async key => mockPositions.get(key) ?? null);
const mockWrite = jest.fn(async (key: string, value: unknown, _grant?: Grant, epoch?: number) => { if (epoch === mockEpoch) mockPositions.set(key, value); });
let mockPage: PageProps;
const mockScrollTo = jest.fn();
const frames = new Map<number, FrameRequestCallback>();
const keyboardListeners = new Map<string, (event: KeyboardEvent) => void>();
let nextFrame = 1;
jest.mock('expo-router', () => ({ router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: mockLocale, t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en, session: mockSession, base: 'https://example.test' }) }));
jest.mock('../../native/cache', () => ({ cacheGeneration: () => mockEpoch, readCache: (key: string) => mockRead(key), writeCache: (...args: Parameters<typeof mockWrite>) => mockWrite(...args) }));
jest.mock('../../state/Billing', () => ({ useBilling: () => ({ canPurchase: false }) }));
jest.mock('../../state/useProductAccess', () => ({ useProductAccess: () => ({ unlimited: false, until: null }) }));
jest.mock('../../state/useRemote', () => ({ useRemote: () => ({ loading: false, data: { units: {} }, reload: jest.fn() }) }));
jest.mock('../AppLink', () => ({ AppLink: () => null, useNavigate: () => jest.fn() }));
jest.mock('../MatrixMap', () => ({ MatrixMap: () => null }));
jest.mock('../ui', () => {
  const original = jest.requireActual<typeof import('../ui')>('../ui');
  const React = jest.requireActual<typeof import('react')>('react');
  const Native = jest.requireActual<typeof import('react-native')>('react-native');
  return { ...original, Page: (props: PageProps) => {
    mockPage = props;
    React.useImperativeHandle(props.scrollRef, () => ({ scrollTo: mockScrollTo }) as unknown as MockScrollViewInstance, []);
    return React.createElement(Native.View, {}, props.children, props.footer);
  } };
});

function sampleSections(locked = true): SectionOut[] {
  return [
    { key: 'character', title: 'Character and personal qualities', lead: 'Complete character lead', access: 'free', locked: false,
      positions: [{ label: 'Public portrait', arcanum: 5, href: '/encyclopedia/arcanum/5', text: 'Complete character interpretation' }] },
    { key: 'comfort', title: 'Comfort and personal resources', lead: 'Complete comfort lead', access: 'free', locked: false, positions: [] },
    { key: 'years', title: 'The full long title of the age periods section', lead: 'PRIVATE YEAR LEAD', access: 'paid', locked,
      positions: [{ label: 'Public year', arcanum: 10, href: '/encyclopedia/arcanum/10', text: 'PRIVATE YEAR INTERPRETATION' }] },
  ];
}
function Sections({ sections, scope = 'owner-1', ready = true }: { sections: SectionOut[]; scope?: string; ready?: boolean }) {
  const reader = useReaderSections(sections.map(({ key, title, locked, positions }) => ({ key, title, locked, positions })), `${scope}:${sections.map(s => s.locked).join(',')}`, ready);
  return <><ReaderContentsButton />{sections.map(section => <ReaderAnchor key={section.key} sectionKey={section.key}>
    <ReadingSection section={section} open={reader?.openKey === section.key} onOpenChange={open => reader?.toggle(section.key, open)} footer={<ReaderSectionEnd sectionKey={section.key} />} />
  </ReaderAnchor>)}</>;
}
function reading(sections = sampleSections(), readerKey = 'report-1') {
  return <ReaderPage readerKey={readerKey}><Sections sections={sections} /></ReaderPage>;
}
async function layout(key: string, y: number, height = 100) {
  await fireEvent(screen.getByTestId(`reader-section-${key}`), 'layout', { nativeEvent: { layout: { x: 0, y, width: 324, height } } });
}
async function flushFrames() {
  await act(() => { const work = [...frames.values()]; frames.clear(); for (const callback of work) callback(0); });
}
async function scroll(y: number, height = 600, contentHeight = 4000) {
  await act(() => mockPage.onScroll?.({ nativeEvent: { contentOffset: { x: 0, y }, layoutMeasurement: { width: 360, height }, contentSize: { width: 360, height: contentHeight } } } as NativeSyntheticEvent<NativeScrollEvent>));
}

beforeEach(() => {
  jest.clearAllMocks(); frames.clear(); keyboardListeners.clear(); mockLocale = 'en';
  mockPositions.clear(); mockSession = null; mockEpoch = 0;
  mockRead.mockImplementation(async key => mockPositions.get(key) ?? null);
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => { const id = nextFrame++; frames.set(id, callback); return id; });
  jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id: number | null | undefined) => { if (id != null) frames.delete(id); });
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
    keyboardListeners.set(name, listener); return { remove: () => { keyboardListeners.delete(name); } };
  });
});
afterEach(() => { jest.restoreAllMocks(); });

it.each(['ru', 'en'] as const)('opens a complete %s contents list and labels locked sections before any reading starts', async locale => {
  mockLocale = locale;
  await render(reading());
  expect(screen.getByTestId('reader-current-title')).toHaveTextContent(locale === 'ru' ? 'Выбрать раздел' : 'Choose a section');
  expect(screen.queryByText('Complete character lead')).toBeNull();
  await fireEvent.press(screen.getByTestId('reader-contents'));
  expect(screen.getAllByTestId(/^contents-/)).toHaveLength(3);
  expect(screen.getByTestId('contents-years').props.accessibilityLabel).toContain(locale === 'ru' ? 'Закрыта' : 'Locked');
  expect(screen.getByTestId('contents-years').props.accessibilityLabel).toContain('The full long title of the age periods section');
  await fireEvent.press(screen.getByTestId('reader-close-contents'));
  expect(screen.queryByTestId('reader-contents-sheet')).toBeNull();
});

it('waits for the new layout before jumping past a previously expanded long section', async () => {
  await render(reading());
  await layout('character', 600); await layout('comfort', 720); await layout('years', 840);
  await fireEvent.press(screen.getByTestId('reader-next'));
  expect(screen.getByText('Complete character interpretation')).toBeTruthy();
  await layout('character', 600, 2400); await layout('comfort', 3018); await layout('years', 3136);
  await flushFrames();
  expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 588, animated: false });
  mockScrollTo.mockClear();
  await fireEvent.press(screen.getByTestId('reader-contents'));
  await fireEvent.press(screen.getByTestId('contents-years'));
  await flushFrames();
  expect(mockScrollTo).not.toHaveBeenCalled();
  expect(screen.queryByText('Complete character interpretation')).toBeNull();
  expect(screen.queryByText('PRIVATE YEAR LEAD')).toBeNull();
  expect(screen.queryByText('PRIVATE YEAR INTERPRETATION')).toBeNull();
  await layout('character', 600); await layout('comfort', 720); await layout('years', 840, 510);
  await flushFrames();
  expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 828, animated: false });
  expect(screen.getByTestId('reader-current-title')).toHaveTextContent('The full long title of the age periods section');
  expect(screen.queryByTestId('reader-next')).toBeNull();
});

it('follows manual scrolling, opens the next section from its end, and returns to contents', async () => {
  await render(reading());
  await layout('character', 600); await layout('comfort', 720); await layout('years', 840);
  await scroll(0);
  expect(screen.getByTestId('reader-current-title')).toHaveTextContent('Choose a section');
  await fireEvent.press(screen.getByTestId('section-character'));
  await layout('character', 600, 1600); await layout('comfort', 2218); await layout('years', 2336);
  await flushFrames(); await scroll(1200);
  expect(screen.getByTestId('reader-current-title')).toHaveTextContent('Character and personal qualities');
  await fireEvent.press(screen.getByTestId('reader-next-character'));
  expect(screen.getByText('Complete comfort lead')).toBeTruthy();
  expect(screen.queryByText('Complete character lead')).toBeNull();
  await layout('character', 600); await layout('comfort', 720, 900); await layout('years', 1638); await flushFrames();
  expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 708, animated: false });
  await fireEvent.press(screen.getByRole('button', { name: 'Back to contents' }));
  expect(screen.getByTestId('contents-comfort').props.accessibilityState.selected).toBe(true);
});

it('discards a pending jump after account/report switch and never reopens revoked content', async () => {
  const view = await render(reading(sampleSections(false)));
  await fireEvent.press(screen.getByTestId('section-years'));
  expect(screen.getByText('PRIVATE YEAR INTERPRETATION')).toBeTruthy();
  await layout('years', 900, 1500);
  await view.rerender(reading(sampleSections(), 'report-other-owner'));
  await flushFrames();
  expect(mockScrollTo).not.toHaveBeenCalled();
  expect(screen.queryByText('PRIVATE YEAR INTERPRETATION')).toBeNull();
  expect(screen.getByTestId('section-years').props.accessibilityState.expanded).toBe(false);
  expect(screen.getByTestId('reader-current-title')).toHaveTextContent('Choose a section');
});

it('closes an open section when access is revoked within the same report', async () => {
  const view = await render(reading(sampleSections(false)));
  await fireEvent.press(screen.getByTestId('section-years'));
  expect(screen.getByText('PRIVATE YEAR LEAD')).toBeTruthy();
  await view.rerender(reading(sampleSections()));
  expect(screen.getByTestId('section-years').props.accessibilityState.expanded).toBe(false);
  expect(screen.queryByText('PRIVATE YEAR LEAD')).toBeNull();
  await fireEvent.press(screen.getByTestId('section-years'));
  expect(screen.queryByText('PRIVATE YEAR INTERPRETATION')).toBeNull();
});

it('hides the dock while the keyboard is visible and restores it after editing', async () => {
  await render(reading());
  expect(screen.getByTestId('reader-toolbar')).toBeTruthy();
  await act(() => keyboardListeners.get('keyboardDidShow')?.({} as KeyboardEvent));
  expect(screen.queryByTestId('reader-toolbar')).toBeNull();
  await act(() => keyboardListeners.get('keyboardDidHide')?.({} as KeyboardEvent));
  expect(screen.getByTestId('reader-toolbar')).toBeTruthy();
});

it('registers the actual couple spheres, charts, chakras and business sections with matching access', async () => {
  await render(<ReaderPage readerKey="pair"><PairReading dates={{ a: '1987-06-14', b: '1990-03-21' }} /></ReaderPage>);
  await fireEvent.press(screen.getByTestId('reader-contents'));
  const entries = screen.getAllByTestId(/^contents-/);
  expect(entries.length).toBeGreaterThan(10);
  for (const entry of entries) {
    const key = String(entry.props.testID).slice('contents-'.length);
    expect(screen.getByTestId(`section-${key}`, { includeHiddenElements: true })).toBeTruthy();
  }
  expect(screen.getAllByTestId(/^arcanum-image-/).length).toBeGreaterThan(10);
  expect(screen.getByTestId('contents-pair-chakras').props.accessibilityLabel).toContain('Locked');
  expect(screen.getByTestId('contents-business-map').props.accessibilityLabel).not.toContain('Locked');
  await fireEvent.press(screen.getByTestId('contents-pair-chakras'));
  expect(screen.getByTestId('section-pair-chakras').props.accessibilityState.expanded).toBe(true);
  expect(screen.getByText('The full text is available with a purchase or subscription.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('reader-next'));
  expect(screen.getByTestId('section-business-map').props.accessibilityState.expanded).toBe(true);
  expect(screen.getByTestId('section-pair-chakras').props.accessibilityState.expanded).toBe(false);
});

it('restores the selected chapter after reopening, waits for layout, and stores no text', async () => {
  mockSession = { user: { id: 7 } };
  const first = await render(reading());
  await fireEvent.press(screen.getByTestId('section-comfort'));
  expect(mockWrite).toHaveBeenLastCalledWith(expect.any(String), { chapter: 'comfort' }, { userId: 7, until: null }, 0);
  await first.unmount(); mockScrollTo.mockClear();
  mockLocale = 'ru';
  await render(reading());
  expect(screen.getByTestId('section-comfort').props.accessibilityState.expanded).toBe(true);
  expect(screen.getByText('Complete comfort lead')).toBeTruthy();
  await flushFrames(); expect(mockScrollTo).not.toHaveBeenCalled();
  await layout('comfort', 720, 900); await flushFrames();
  expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 708, animated: false });
  expect([...mockPositions.values()]).toEqual([{ chapter: 'comfort' }]);
});

it('isolates positions across reports, accounts and deletion even when the caller reuses its reader key', async () => {
  mockSession = { user: { id: 7 } };
  const view = await render(reading());
  await fireEvent.press(screen.getByTestId('section-comfort'));
  await view.rerender(reading(sampleSections(), 'report-2'));
  expect(screen.getByTestId('section-comfort').props.accessibilityState.expanded).toBe(false);
  await view.rerender(reading());
  expect(screen.getByTestId('section-comfort').props.accessibilityState.expanded).toBe(true);
  mockSession = { user: { id: 8 } };
  await view.rerender(reading());
  expect(screen.getByTestId('section-comfort').props.accessibilityState.expanded).toBe(false);
  mockSession = { user: { id: 7 }, deletion: {} };
  await view.rerender(reading());
  expect(screen.getByTestId('section-comfort').props.accessibilityState.expanded).toBe(false);
  const writes = mockWrite.mock.calls.length;
  await fireEvent.press(screen.getByTestId('section-character'));
  expect(mockWrite).toHaveBeenCalledTimes(writes);
});

it('does not let a delayed restore override a selection or revive an old account', async () => {
  let resolve!: (value: unknown) => void;
  mockRead.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = await render(reading());
  await fireEvent.press(screen.getByTestId('section-comfort'));
  await act(() => resolve({ chapter: 'character' }));
  expect(screen.getByTestId('section-comfort').props.accessibilityState.expanded).toBe(true);
  await view.unmount();
  mockSession = { user: { id: 7 } };
  mockRead.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const switched = await render(reading());
  mockSession = { user: { id: 8 } }; mockEpoch++;
  await switched.rerender(reading());
  await act(() => resolve({ chapter: 'character' }));
  expect(screen.getByTestId('section-character').props.accessibilityState.expanded).toBe(false);
});

it.each(['years', 'removed_chapter'])('does not reopen an unavailable stored chapter: %s', async chapter => {
  const position = readerPosition('report-1', { base: 'https://example.test' })!;
  mockPositions.set(position.key, { chapter });
  await render(reading());
  expect(screen.getByTestId('section-years').props.accessibilityState.expanded).toBe(false);
  expect(screen.queryByText('PRIVATE YEAR LEAD')).toBeNull();
  expect(screen.getByTestId('reader-current-title')).toHaveTextContent('Choose a section');
});

it('waits for confirmed rights before restoring a paid chapter, then closes it on revocation', async () => {
  mockSession = { user: { id: 7 } };
  const position = readerPosition('report-1', { userId: 7, base: 'https://example.test' })!;
  mockPositions.set(position.key, { chapter: 'years' });
  const view = await render(<ReaderPage readerKey="report-1"><Sections sections={sampleSections()} ready={false} /></ReaderPage>);
  expect(mockRead).not.toHaveBeenCalledWith(position.key);
  expect(screen.queryByText('PRIVATE YEAR LEAD')).toBeNull();
  await view.rerender(<ReaderPage readerKey="report-1"><Sections sections={sampleSections(false)} ready /></ReaderPage>);
  expect(screen.getByTestId('section-years').props.accessibilityState.expanded).toBe(true);
  expect(screen.getByText('PRIVATE YEAR LEAD')).toBeTruthy();
  await view.rerender(<ReaderPage readerKey="report-1"><Sections sections={sampleSections()} ready /></ReaderPage>);
  expect(screen.getByTestId('section-years').props.accessibilityState.expanded).toBe(false);
  expect(screen.queryByText('PRIVATE YEAR LEAD')).toBeNull();
});

it('keeps a manual free-chapter choice and its pending jump when rights finish loading', async () => {
  const view = await render(<ReaderPage readerKey="report-1"><Sections sections={sampleSections()} ready={false} /></ReaderPage>);
  await fireEvent.press(screen.getByTestId('section-comfort'));
  await layout('comfort', 720, 900);
  await view.rerender(<ReaderPage readerKey="report-1"><Sections sections={sampleSections(false)} ready /></ReaderPage>);
  expect(screen.getByTestId('section-comfort').props.accessibilityState.expanded).toBe(true);
  expect(screen.getByText('Complete comfort lead')).toBeTruthy();
  await flushFrames();
  expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 708, animated: false });
});

it('marks a read section in the shared contents and never marks a locked section', async () => {
  await render(reading());
  await layout('character', 600); await layout('comfort', 720); await layout('years', 840);
  await fireEvent.press(screen.getByTestId('reader-next'));
  await layout('character', 600, 900); await flushFrames();
  await scroll(920);
  await fireEvent.press(screen.getByTestId('reader-contents'));
  expect(screen.getByTestId('contents-character').props.accessibilityLabel).toContain('Read');
  await fireEvent.press(screen.getByTestId('contents-years'));
  await layout('years', 840, 300); await flushFrames();
  await scroll(840);
  await fireEvent.press(screen.getByTestId('reader-contents'));
  expect(screen.getByTestId('contents-years').props.accessibilityLabel).toContain('Locked');
  expect(screen.getByTestId('contents-years').props.accessibilityLabel).not.toContain('Read');
});
