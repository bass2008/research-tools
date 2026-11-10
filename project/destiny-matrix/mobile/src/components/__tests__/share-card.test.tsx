import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { ShareCard } from '../ShareCard';

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn<() => Promise<string>>().mockResolvedValue('file:///cache/card.png'), releaseCapture: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  shareAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) }));
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: 'ru',
  session: { user: { email: 'private@example.org' } }, t: (ru: string) => ru }) }));

beforeEach(() => { jest.clearAllMocks(); });

it('exports only the matrix and date after a deliberate tap, at 1080 × 1920', async () => {
  await render(<ShareCard content={{ kind: 'matrix', birth: '1987-06-14', points: { E: 9 } }} />);
  expect(captureRef).not.toHaveBeenCalled();
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('share-matrix-open'));
  const card = screen.getByTestId('share-matrix-card');
  expect(within(card).getByText('14.06.1987')).toBeTruthy();
  expect(within(card).queryByText('private@example.org')).toBeNull();
  await fireEvent(card, 'layout', { nativeEvent: { layout: { width: 360, height: 640 } } });
  await fireEvent.press(screen.getByTestId('share-matrix-send'));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/card.png',
    expect.objectContaining({ mimeType: 'image/png' })));
  expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ width: 1080, height: 1920 }));
  expect(releaseCapture).toHaveBeenCalledWith('file:///cache/card.png');
});

it('waits for the deck image before sharing the daily theme', async () => {
  await render(<ShareCard content={{ kind: 'daily', arcanum: 1 }} />);
  await fireEvent.press(screen.getByTestId('share-daily-open'));
  await fireEvent(screen.getByTestId('share-daily-card'), 'layout', { nativeEvent: { layout: { width: 360, height: 640 } } });
  expect(screen.getByTestId('share-daily-send').props.accessibilityState.disabled).toBe(true);
  await fireEvent(screen.getByTestId('arcanum-art-1'), 'load');
  await fireEvent.press(screen.getByTestId('share-daily-send'));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
});
