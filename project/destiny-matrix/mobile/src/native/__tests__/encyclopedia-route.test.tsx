import { beforeEach, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import EncyclopediaArticle from '../../app/encyclopedia/[...path]';
import YearReference from '../../app/encyclopedia/year';
import { redirectSystemPath } from '../../app/+native-intent';

let mockParams: Record<string, string | string[]>;
const mockArticle = jest.fn<(props: { path: string }) => null>(() => null);
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('../../components/Article', () => ({ Article: (props: { path: string }) => mockArticle(props) }));

beforeEach(() => { jest.clearAllMocks(); });

it('opens the year reference hub from the library without entering the year calculator', async () => {
  await render(<YearReference />);
  expect(mockArticle.mock.calls.at(-1)?.[0].path).toBe('/year');
});

it.each(['ru', 'en'])('opens a %s arcanum deep link without leaking the app locale into the BFF path', async locale => {
  const route = redirectSystemPath({ path: `arcanasense://${locale}/encyclopedia/arcanum/5`, initial: false });
  const url = new URL(route, 'https://arcana-sense.com');
  expect(url.searchParams.get('lang')).toBe(locale);
  mockParams = { path: url.pathname.slice('/encyclopedia/'.length).split('/'), ...Object.fromEntries(url.searchParams) };
  await render(<EncyclopediaArticle />);
  expect(mockArticle.mock.calls.at(-1)?.[0].path).toBe('/encyclopedia/arcanum/5');
});

it.each(['ru', 'en'])('preserves product query parameters and repeated values for %s', async lang => {
  mockParams = { path: ['arcanum', '5'], lang, birth: '1990-06-14', tab: 'love', topic: ['one', 'two'], language: 'original', search: 'A & B' };
  await render(<EncyclopediaArticle />);
  const url = new URL(mockArticle.mock.calls.at(-1)![0].path, 'https://arcana-sense.com');
  expect(url.pathname).toBe('/encyclopedia/arcanum/5');
  expect(url.searchParams.has('lang')).toBe(false);
  expect([...url.searchParams]).toEqual([
    ['birth', '1990-06-14'], ['tab', 'love'], ['topic', 'one'], ['topic', 'two'], ['language', 'original'], ['search', 'A & B'],
  ]);
});
