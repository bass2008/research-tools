import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Calculator from '../../app/calculate';

jest.mock('../../state/Me', () => ({ useMe: () => ({ me: { birth: '1990-01-01', sex: 'f' }, saveMe: jest.fn() }) }));
let mockLocale: 'ru' | 'en' = 'ru';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: mockLocale, t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en }) }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); });
it('keeps date entry usable across languages', async () => {
  mockLocale = 'ru';
  const view = await render(<Calculator />);
  await fireEvent.changeText(screen.getByTestId('birth-day'), '14');
  await fireEvent.changeText(screen.getByTestId('birth-month'), '6');
  await fireEvent.changeText(screen.getByTestId('birth-year'), '1987');
  await fireEvent.press(screen.getByTestId('sex-m'));
  mockLocale = 'en'; await view.rerender(<Calculator />);
  expect(screen.getByDisplayValue('1987')).toBeTruthy();
  expect(screen.getAllByTestId('calculate')).toHaveLength(1);
  await fireEvent.press(screen.getByTestId('calculate'));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: '/report', params: { birth: '1987-06-14', sex: 'm' } }));
});
