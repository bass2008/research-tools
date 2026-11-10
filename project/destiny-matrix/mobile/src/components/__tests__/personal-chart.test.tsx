import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { calculate } from '@/lib/matrix';
import { pointsOf } from '@/lib/pair/engine';
import type { SectionOut } from '@/lib/publicSpec';
import { PersonalChart } from '../PersonalChart';

const mockSelect = jest.fn();
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
  setItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: 'ru', t: (ru: string) => ru }) }));
jest.mock('../ReaderNavigation', () => ({ useReader: () => ({ select: mockSelect }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useIsFocused: () => true }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
const points = pointsOf(calculate({ year: 1987, month: 6, day: 14 }, 'f'));
const sections: SectionOut[] = [{ key: 'parents_children', title: 'Родители и дети', access: 'paid', locked: true,
  lead: 'PRIVATE LEAD', positions: (['F', 'G', 'H'] as const).map(key => ({
    label: 'PRIVATE LABEL', arcanum: points[key], href: `/encyclopedia/arcanum/${points[key]}`, text: 'PRIVATE TEXT',
  })) }];
beforeEach(() => { jest.clearAllMocks(); });
it('opens a public card sheet with haptics and persists the dismissed hint', async () => {
  const view = await render(<PersonalChart points={points} sections={sections} />);
  await screen.findByText('Нажмите на любую точку');
  await fireEvent.press(screen.getByTestId('matrix-point-E'));
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('arcana.point-tapped', '1');
  expect(screen.getByTestId('point-sheet')).toBeTruthy();
  expect(screen.getByText('Центр карты')).toBeTruthy();
  expect(screen.getByTestId('arcanum-image-9')).toBeTruthy();
  expect(screen.getByText('9 в этой позиции')).toBeTruthy();
  expect(screen.queryByText('Нажмите на любую точку')).toBeNull();
  await view.unmount();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('1');
  await render(<PersonalChart points={points} />);
  await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Нажмите на любую точку')).toBeNull();
});
it('opens the matching locked chapter without reading its private labels or text into the sheet', async () => {
  await render(<PersonalChart points={points} sections={sections} initialPoint="F" />);
  expect(screen.queryByText(/PRIVATE/)).toBeNull();
  await fireEvent.press(screen.getByTestId('point-read-chapter'));
  expect(mockSelect).toHaveBeenCalledWith('parents_children');
});
