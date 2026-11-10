import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Compatibility from '../../app/(tabs)/compatibility';

let mockMe: { birth: string; sex: 'f' } | null = null;
jest.mock('../../state/Me', () => ({ useMe: () => ({ me: mockMe }) }));

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useFocusEffect: jest.fn() }));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: 'ru', session: null, t: (ru: string) => ru }) }));
jest.mock('../AppLink', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../PairReading', () => ({ PairReading: ({ dates }: { dates: { a: string; b: string } }) => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return <Text testID="pair-dates">{`${dates.a} / ${dates.b}`}</Text>;
} }));

beforeEach(() => { mockParams = {}; mockMe = null; });

it('opens the exact pair from a purchase link, preserves dates when editing and accepts a new link', async () => {
  mockParams = { a: '1987-06-14', b: '1999-05-27' };
  const view = await render(<Compatibility />);
  expect(screen.getByText('1987-06-14 / 1999-05-27')).toBeTruthy();
  expect(screen.queryByTestId('partner-a-year')).toBeNull();
  await fireEvent.press(screen.getByTestId('edit-calculation'));
  expect(screen.getByTestId('partner-a-year').props.value).toBe('1987');
  expect(screen.getByTestId('partner-b-day').props.value).toBe('27');
  await fireEvent.changeText(screen.getByTestId('partner-b-day'), '28');
  await fireEvent.press(screen.getByTestId('calculate-pair'));
  expect(screen.getByText('1987-06-14 / 1999-05-28')).toBeTruthy();
  mockParams = { a: '1990-01-01', b: '1992-02-02' };
  await view.rerender(<Compatibility />);
  expect(screen.getByText('1990-01-01 / 1992-02-02')).toBeTruthy();
});

it('keeps the form for an invalid deep link and rejects an impossible date without replacing it', async () => {
  mockParams = { a: '2000-02-31', b: '1999-05-27' };
  await render(<Compatibility />);
  expect(screen.queryByTestId('pair-dates')).toBeNull();
  for (const [field, value] of [['day', '31'], ['month', '02'], ['year', '2000']]) {
    await fireEvent.changeText(screen.getByTestId(`partner-a-${field}`), value);
  }
  for (const [field, value] of [['day', '27'], ['month', '05'], ['year', '1999']]) {
    await fireEvent.changeText(screen.getByTestId(`partner-b-${field}`), value);
  }
  await fireEvent.press(screen.getByTestId('calculate-pair'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByTestId('pair-dates')).toBeNull();
  expect(screen.getByTestId('partner-a-day').props.value).toBe('31');
});


it('prefills my date as the first partner and keeps both dates editable', async () => {
  mockMe = { birth: '1987-06-14', sex: 'f' };
  await render(<Compatibility />);
  expect(screen.getByTestId('partner-a-day').props.value).toBe('14');
  expect(screen.getByTestId('partner-a-year').props.value).toBe('1987');
  for (const [field, value] of [['day', '27'], ['month', '05'], ['year', '1999']]) {
    await fireEvent.changeText(screen.getByTestId(`partner-b-${field}`), value);
  }
  await fireEvent.changeText(screen.getByTestId('partner-a-day'), '15');
  await fireEvent.press(screen.getByTestId('calculate-pair'));
  expect(screen.getByText('1987-06-15 / 1999-05-27')).toBeTruthy();
  expect(mockMe.birth).toBe('1987-06-14');
});
