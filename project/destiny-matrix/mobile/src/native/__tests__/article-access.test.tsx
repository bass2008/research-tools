import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { MobileArticle } from '@/lib/mobileContentContract';
import { D } from '@/lib/i18n';
import type { Guard } from '../http';
import { Article } from '../../components/Article';
import { theme } from '../../state/Design';

let mockArticle: MobileArticle;
let mockLocale: 'ru' | 'en' = 'en';
let mockDimensions = { width: 393, height: 852, fontScale: 1, scale: 2.75 };
const mockNavigate = jest.fn<(href: string) => Promise<void>>(() => Promise.resolve());
const mockRemote = jest.fn<(path: string, guard: Guard<MobileArticle>) => void>();
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../state/useRemote', () => ({ useRemote: (path: string, guard: Guard<MobileArticle>) => {
  mockRemote(path, guard);
  return { data: mockArticle, loading: false, offline: false, reload: jest.fn() };
} }));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: mockLocale, t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en }) }));
jest.mock('../../components/AppLink', () => ({ AppLink: () => null, useNavigate: () => mockNavigate }));
jest.mock('../../components/MatrixMap', () => ({ MatrixMap: () => null }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDimensions }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn<() => Promise<string | null>>().mockResolvedValue(null), setItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = 'en';
  mockDimensions = { width: 393, height: 852, fontScale: 1, scale: 2.75 };
  mockArticle = { schemaVersion: 1, path: '/encyclopedia/arcanum/5', locale: 'en', title: 'Private title',
    lead: 'Private lead', breadcrumbs: [{ label: 'Private breadcrumb' }],
    blocks: [{ type: 'paragraph', text: 'Private interpretation' }], access: 'private', accessUntil: null };
});

it.each(['private', 'locked'] as const)('rejects %s documents at the public cache boundary', async access => {
  mockArticle.access = access;
  await render(<Article path={mockArticle.path} />);
  const guard = mockRemote.mock.calls[0][1];
  expect(guard(mockArticle)).toBe(false);
  expect(guard({ ...mockArticle, access: 'public' })).toBe(true);
  expect(guard({ ...mockArticle, access: 'public', blocks: [{ type: 'unknown' }] })).toBe(false);
});

it.each(['private', 'locked'] as const)('never renders %s article text even if stale data bypassed the remote guard', async access => {
  mockArticle.access = access;
  await render(<Article path={mockArticle.path} />);
  for (const text of ['Private title', 'Private lead', 'Private breadcrumb', 'Private interpretation']) {
    expect(screen.queryByText(text)).toBeNull();
  }
});

it('renders validated public content with the public cache policy', async () => {
  mockArticle.access = 'public';
  await render(<Article path={mockArticle.path} />);
  expect(screen.getByText('Private interpretation')).toBeTruthy();
  expect(mockRemote.mock.calls[0][1](mockArticle)).toBe(true);
});

it('places the actual arcanum image in the header and the Waite image beside its own section', async () => {
  mockArticle.access = 'public';
  mockArticle.blocks = [
    { type: 'cards', cards: [{ arcanum: 5, label: 'The Hierophant', href: '/encyclopedia/arcanum/5' }] },
    { type: 'paragraph', text: 'Opening interpretation' },
    { type: 'heading', text: 'The Hierophant in Waite’s deck', level: 2 },
    { type: 'paragraph', text: 'The traditional card description' },
  ];
  await render(<Article path={mockArticle.path} />);
  expect(screen.getAllByTestId(/^arcanum-image-/).map(image => image.props.testID)).toEqual(['arcanum-image-5', 'arcanum-image-5-waite']);
  expect(screen.getByText('Opening interpretation')).toBeTruthy();
  expect(screen.getByText('The traditional card description')).toBeTruthy();
});

it.each([
  { width: 360, fontScale: 1.3, stacked: true },
  { width: 393, fontScale: 1.3, stacked: true },
  { width: 360, fontScale: 1, stacked: true },
  { width: 393, fontScale: 1, stacked: false },
])('uses a readable article heading at $width dp and font scale $fontScale', async ({ width, fontScale, stacked }) => {
  mockDimensions = { ...mockDimensions, width, fontScale };
  mockArticle = { ...mockArticle, access: 'public', title: '5 in the destiny matrix — The Hierophant, the arcanum of teachers, tradition and a promise kept',
    blocks: [{ type: 'cards', cards: [{ arcanum: 5, label: 'The Hierophant', href: '/encyclopedia/arcanum/5' }] },
      { type: 'paragraph', text: 'Complete canonical interpretation' }] };
  await render(<Article path={mockArticle.path} />);
  expect(screen.getByRole('header', { name: 'The Hierophant' })).toBeTruthy();
  expect(screen.getByText('5 · The Hierophant')).toBeTruthy();
  expect(screen.getByText('Complete canonical interpretation')).toBeTruthy();
  expect(screen.getAllByTestId(/^arcanum-image-/)).toHaveLength(1);
  expect(StyleSheet.flatten(screen.getByTestId('article-hero').props.style).flexDirection).toBe(stacked ? 'column' : 'row');
  expect(StyleSheet.flatten(screen.getByTestId('article-heading').props.style).width).toBe(stacked ? '100%' : undefined);
  expect(Boolean(screen.queryByTestId('article-card-intro'))).toBe(stacked);
  expect(StyleSheet.flatten(screen.getByTestId('arcanum-image-5').props.style).width).toBe(stacked ? 88 : 112);
});

it('filters the existing encyclopedia catalogue without hiding the article prose', async () => {
  mockArticle = { ...mockArticle, access: 'public', path: '/encyclopedia/arcanum', blocks: [
    { type: 'paragraph', text: 'Canonical explanation of the 22 arcana' },
    ...Array.from({ length: 22 }, (_, i) => ({ type: 'link' as const, label: `Card ${i + 1}`, href: `/encyclopedia/arcanum/${i + 1}` })),
  ] };
  await render(<Article path={mockArticle.path} />);
  expect(screen.getAllByTestId(/^arcanum-image-/)).toHaveLength(22);
  await fireEvent.changeText(screen.getByTestId('encyclopedia-search'), 'Card 5');
  expect(screen.getByRole('link', { name: 'Card 5' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Card 4' })).toBeNull();
  expect(screen.getAllByTestId(/^arcanum-image-/).map(image => image.props.testID)).toEqual(['arcanum-image-5']);
  expect(screen.getByText('Canonical explanation of the 22 arcana')).toBeTruthy();
});

it.each(['ru', 'en'] as const)('keeps every %s library destination', async locale => {
  mockLocale = locale;
  mockDimensions = { width: 360, height: 800, fontScale: 1.3, scale: 2 };
  const destinations: [keyof typeof D.encSections, string][] = [
    ['arc', '/encyclopedia/arcanum'], ['sec', '/encyclopedia/position'], ['pts', '/encyclopedia/position'],
    ['chk', '/encyclopedia/chakra'], ['tls', '/encyclopedia/karmic-tail'], ['yer', '/year'],
    ['cmp', '/encyclopedia/compatibility'], ['ptl', '/encyclopedia/compatibility/tails'], ['cmb', '/encyclopedia/combination'],
  ];
  mockArticle = { ...mockArticle, access: 'public', path: '/encyclopedia', locale,
    lead: 'Complete canonical library introduction', blocks: [
      ...destinations.map(([key, href]) => ({ type: 'link' as const, href, label: D.encSections[key].title[locale] })),
      { type: 'link', href: '/encyclopedia/month', label: 'Month article' },
    ] };
  await render(<Article path={mockArticle.path} tab />);
  await screen.findByTestId(`design-ready-atelier-library-${locale}`);
  expect(screen.getByTestId('design-library')).toBeTruthy();
  expect(screen.getAllByTestId(/^library-topic-\d/)).toHaveLength(10);
  expect(screen.getAllByTestId(/^arcanum-image-/, { includeHiddenElements: true }).length).toBeGreaterThan(0);
  for (const [key, href] of destinations) {
    await fireEvent.press(screen.getByRole('link', { name: D.encSections[key].title[locale] }));
    expect(mockNavigate).toHaveBeenLastCalledWith(href === '/year' ? '/encyclopedia/year' : href);
  }
  await fireEvent.press(screen.getByRole('link', { name: 'Month article' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/encyclopedia/month');
  expect(screen.queryByText(mockArticle.lead)).toBeNull();
});

it('keeps prose readable on canvas and tables/cards on paper without marking an article as the library', async () => {
  mockArticle = { ...mockArticle, access: 'public', path: '/encyclopedia/position/character', title: 'Canvas title', lead: 'Canvas lead', blocks: [
    { type: 'heading', level: 2, text: 'Canvas heading' }, { type: 'paragraph', text: 'Canvas interpretation' },
    { type: 'table', head: ['Table heading'], rows: [['Table meaning']] },
    { type: 'cards', cards: [{ arcanum: 5, label: 'Card caption', href: '/encyclopedia/arcanum/5' }] },
  ] };
  await render(<Article path={mockArticle.path} />);
  for (const text of ['Canvas title', 'Canvas heading', 'Canvas interpretation', 'Canvas lead']) {
    expect(StyleSheet.flatten(screen.getByText(text).props.style).color).toBe(theme.ink);
  }
  expect(StyleSheet.flatten(screen.getByText('Table meaning').props.style).color).toBe('#243632');
  expect(StyleSheet.flatten(screen.getByText('5 · Card caption').props.style).color).toBe('#1b2536');
  expect(screen.queryByTestId('design-library')).toBeNull();
  expect(screen.queryByTestId(/^design-ready-.*-library-/)).toBeNull();
});

it('puts the card catalogue before the complete reference introduction', async () => {
  mockArticle = { ...mockArticle, access: 'public', path: '/encyclopedia/arcanum', lead: 'Complete canonical catalogue lead', blocks: [
    { type: 'paragraph', text: 'Complete canonical reference paragraph' },
    ...Array.from({ length: 22 }, (_, i) => ({ type: 'link' as const, label: `Card ${i + 1}`, href: `/encyclopedia/arcanum/${i + 1}` })),
  ] };
  await render(<Article path={mockArticle.path} />);
  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf('encyclopedia-search')).toBeLessThan(tree.indexOf('arcanum-grid'));
  expect(tree.indexOf('arcanum-grid')).toBeLessThan(tree.indexOf('Complete canonical catalogue lead'));
  expect(screen.getByText('Complete canonical catalogue lead')).toBeTruthy();
  expect(screen.getByText('Complete canonical reference paragraph')).toBeTruthy();
});

it.each(['ru', 'en'] as const)('opens date input only for the canonical %s calculator CTA, preserving Home links', async locale => {
  mockLocale = locale;
  mockArticle = { ...mockArticle, access: 'public', locale, blocks: [
    { type: 'link', href: '/', label: D.matrixPages.calcMatrix[locale] },
    { type: 'link', href: '/', label: D.nav.home[locale] },
  ] };
  await render(<Article path={mockArticle.path} />);
  await fireEvent.press(screen.getByRole('link', { name: D.matrixPages.calcMatrix[locale] }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/calculate');
  await fireEvent.press(screen.getByRole('link', { name: D.nav.home[locale] }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/');
});


it.each(['ru', 'en'] as const)('searches the %s arcana and clears back to all 22 cards', async locale => {
  mockLocale = locale;
  mockArticle = { ...mockArticle, access: 'public', path: '/encyclopedia', blocks: [] };
  await render(<Article path="/encyclopedia" tab />);
  expect(screen.getAllByTestId(/^library-arcanum-/)).toHaveLength(22);
  await fireEvent.changeText(screen.getByTestId('library-search'), locale === 'ru' ? 'Жрица' : 'Priestess');
  expect(screen.queryByTestId('library-arcanum-1')).toBeNull();
  await fireEvent.press(screen.getByRole('link', { name: locale === 'ru' ? 'Жрица' : 'The High Priestess' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/encyclopedia/arcanum/2');
  await fireEvent.press(screen.getByRole('button', { name: locale === 'ru' ? 'Очистить поиск' : 'Clear search' }));
  expect(screen.getAllByTestId(/^library-arcanum-/)).toHaveLength(22);
});

it('omits website breadcrumbs from a public article', async () => {
  mockArticle = { ...mockArticle, access: 'public' };
  await render(<Article path={mockArticle.path} />);
  expect(screen.queryByText('Private breadcrumb')).toBeNull();
  expect(screen.getByText('Private interpretation')).toBeTruthy();
});
