import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Lang } from '@/lib/i18n/hosts';
import { D } from '@/lib/i18n';
import Year from '../../app/year';

jest.mock('../../state/Me', () => ({ useMe: () => ({ me: { birth: '1987-06-14', sex: 'f' } }) }));

let mockLocale: Lang = 'ru';
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: mockLocale,
  t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en }) }));
jest.mock('../../state/useRemote', () => ({ useRemote: () => ({ loading: false, data: {}, reload: jest.fn() }) }));
jest.mock('../MatrixMap', () => ({ MatrixMap: () => null }));
jest.mock('../AppLink', () => ({ AppLink: () => null, useNavigate: () => jest.fn() }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn(), useLocalSearchParams: () => ({}) }));

it.each(['ru', 'en'] as const)('describes the native year calculation as running on the device (%s)', async locale => {
  mockLocale = locale;
  await render(<Year />);
  expect(screen.getByTestId('birth-year').props.value).toBe('1987');
  for (const [field, value] of [['day', '14'], ['month', '06'], ['year', '1987']]) {
    await fireEvent.changeText(screen.getByTestId(`birth-${field}`), value);
  }
  await fireEvent.changeText(screen.getByTestId('forecast-year'), '2026');
  await fireEvent.press(screen.getByTestId('calculate-year'));
  const device = locale === 'ru' ? 'Схема считается прямо на устройстве.' : 'The chart is calculated right on your device.';
  expect(await screen.findByText(new RegExp(device.replace(/\./g, '\\.')))).toBeTruthy();
  expect(screen.queryByText(/в браузере|in your browser/)).toBeNull();
  expect(D.yearLinks.sub[locale]).toContain(locale === 'ru' ? 'в браузере' : 'in your browser');
  expect(screen.queryByTestId('birth-year')).toBeNull();
  await fireEvent.press(screen.getByTestId('edit-calculation'));
  expect(screen.getByTestId('birth-year').props.value).toBe('1987');
  expect(screen.getByTestId('forecast-year').props.value).toBe('2026');
  await fireEvent.changeText(screen.getByTestId('forecast-year'), '2027');
  await fireEvent.press(screen.getByTestId('calculate-year'));
  expect(screen.getByText('2027')).toBeTruthy();
});
