import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DemoReading } from '../../components/DemoReading';
import { demoReading } from '../demoReading';
import { isMobileSections } from '@/lib/mobileContentContract';
import DemoRoute from '../../app/encyclopedia/demo';

let mockLocale: 'ru' | 'en' = 'ru';
let mockParams: { view?: string; chapter?: string } = {};
const mockPositions = new Map<string, unknown>();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('../../native/cache', () => ({ cacheGeneration: () => 0,
  readCache: async (key: string) => mockPositions.get(key) ?? null,
  writeCache: async (key: string, value: unknown) => { mockPositions.set(key, value); },
}));
const mockApi = jest.fn(() => { throw new Error('The offline demo must not call the API'); });
const mockNavigate = jest.fn<(href: string) => Promise<void>>(() => Promise.resolve());
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: mockLocale, t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en,
  session: null, api: mockApi, setLocale: jest.fn() }) }));
jest.mock('../../state/useRemote', () => ({ useRemote: () => { throw new Error('The offline demo must not load remote content'); } }));
jest.mock('../../components/AppLink', () => ({ AppLink: () => null, useNavigate: () => mockNavigate }));

beforeEach(() => {
  jest.clearAllMocks(); mockPositions.clear(); mockParams = {};
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
});
afterEach(() => { jest.restoreAllMocks(); });

it.each(['ru', 'en'] as const)('contains exactly one complete finite %s automatic reading, not an entitlement', locale => {
  const demo = demoReading(locale);
  expect(demo.locale).toBe(locale);
  expect(demo.birth).toBe('1992-08-12');
  expect(demo.kind).toBe('automatic-personal-demo');
  expect(isMobileSections(demo)).toBe(true);
  expect(demo.sections).toHaveLength(22);
  expect(new Set(demo.sections.map(section => section.key)).size).toBe(22);
  expect(demo.sections.every(section => !section.locked)).toBe(true);
  expect(demo.sections.some(section => section.access === 'paid')).toBe(true);
  expect(demo.highlights).toHaveLength(5);
  expect(demoReading(locale)).toBe(demo);
  expect(mockApi).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
});

it.each(['ru', 'en'] as const)('opens real %s reading text and its final chapter with no account and no network', async locale => {
  mockLocale = locale;
  const demo = demoReading(locale);
  await render(<DemoReading initialScene="reading" />);
  expect(screen.getByTestId('demo-persistent-label')).toBeTruthy();
  expect(screen.getByText(demo.sections[0].lead)).toBeTruthy();
  expect(screen.getByText(demo.sections[0].longform!.roles![0].essence!)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('reader-contents'));
  expect(screen.getAllByTestId(/^contents-/)).toHaveLength(22);
  await fireEvent.press(screen.getByTestId('contents-years'));
  const years = demo.sections.at(-1)!;
  expect(screen.getByTestId('section-years').props.accessibilityState.expanded).toBe(true);
  expect(screen.getByText(years.longform!.lead)).toBeTruthy();
  expect(screen.getByText(demo.periodNotice)).toBeTruthy();
  expect(screen.queryByTestId('reader-next')).toBeNull();
  expect(mockApi).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
});

it.each(['ru', 'en'] as const)('opens the native calculator from the start and end of the %s guest demo', async locale => {
  mockLocale = locale;
  const demo = demoReading(locale);
  await render(<DemoReading initialScene="reading" />);
  await fireEvent.press(screen.getByTestId('demo-calculate-start'));
  expect(mockNavigate).toHaveBeenLastCalledWith('/calculate');
  expect(screen.getByTestId('demo-persistent-label')).toBeTruthy();
  expect(screen.getByText(demo.sections[0].lead)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('reader-contents'));
  await fireEvent.press(screen.getByTestId('contents-years'));
  await fireEvent.press(screen.getByTestId('demo-calculate-end'));
  expect(mockNavigate).toHaveBeenLastCalledWith('/calculate');
  expect(mockNavigate).toHaveBeenCalledTimes(2);
  expect(screen.getByText(demo.sections.at(-1)!.longform!.lead)).toBeTruthy();
  expect(screen.getByTestId('demo-persistent-label')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
});

it.each(['ru', 'en'] as const)('renders the new canonical parent-child line offline in %s', async locale => {
  mockLocale = locale;
  const section = demoReading(locale).sections.find(row => row.key === 'parent_child_line')!;
  await render(<DemoReading initialScene="reading" />);
  await fireEvent.press(screen.getByTestId('reader-contents'));
  await fireEvent.press(screen.getByTestId('contents-parent_child_line'));
  expect(screen.getByTestId('section-parent_child_line').props.accessibilityState.expanded).toBe(true);
  for (const text of [section.tripleReading!.heading, ...section.tripleReading!.paragraphs, ...section.tripleReading!.cells.map(cell => cell.caption)]) {
    expect(screen.getByText(text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'))).toBeTruthy();
  }
  expect(mockApi).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
});

it('keeps the real chart and complete offline reading navigable', async () => {
  mockLocale = 'en';
  
  await render(<DemoReading initialScene="chart" />);
  expect(screen.getByTestId('chart-cover-atelier')).toBeTruthy();
  expect(screen.getByTestId('demo-chart')).toBeTruthy();
  expect(screen.getByTestId('matrix-chart')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('demo-calculate-start'));
  expect(mockNavigate).toHaveBeenLastCalledWith('/calculate');
  await fireEvent.press(screen.getByTestId('demo-open-reading'));
  await screen.findByText(demoReading('en').sections[0].lead);
  expect(screen.getByText(demoReading('en').sections[0].longform!.roles![0].essence!)).toBeTruthy();
  expect(screen.queryByTestId('demo-chart')).toBeNull();
  await fireEvent.press(screen.getByTestId('demo-show-chart'));
  expect(screen.getByTestId('demo-chart')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
});

it.each(['ru', 'en'] as const)('opens a targeted %s offline chapter ahead of a saved position', async locale => {
  mockLocale = locale;
  const previous = await render(<DemoReading initialScene="reading" />);
  await fireEvent.press(screen.getByTestId('section-comfort'));
  await previous.unmount();
  mockParams = { view: 'reading', chapter: 'loops' };
  await render(<DemoRoute />);
  expect(screen.getByTestId('section-loops').props.accessibilityState.expanded).toBe(true);
  expect(screen.getByTestId('section-comfort').props.accessibilityState.expanded).toBe(false);
  expect(screen.getByText(demoReading(locale).sections.find(section => section.key === 'loops')!.lead)).toBeTruthy();
  expect(screen.getByTestId('demo-persistent-label')).toBeTruthy();
  expect(screen.getByTestId('demo-calculate-start')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('section-rest'));
  await fireEvent.press(screen.getByTestId('demo-show-chart'));
  expect(screen.getByTestId('demo-chart')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('demo-open-reading'));
  expect(screen.getByTestId('section-rest').props.accessibilityState.expanded).toBe(true);
  expect(mockApi).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
});

it('resumes the same chapter across RU/EN and ignores unknown route chapters', async () => {
  mockLocale = 'ru';
  const previous = await render(<DemoReading initialScene="reading" />);
  await fireEvent.press(screen.getByTestId('section-parent_child_line'));
  await previous.unmount(); mockLocale = 'en';
  mockParams = { view: 'reading', chapter: 'unknown' };
  await render(<DemoRoute />);
  expect(screen.getByTestId('section-parent_child_line').props.accessibilityState.expanded).toBe(true);
  expect(screen.getByText(demoReading('en').sections.find(section => section.key === 'parent_child_line')!.lead)).toBeTruthy();
  expect([...mockPositions.values()]).toEqual([{ chapter: 'parent_child_line' }]);
  expect(mockApi).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
});
