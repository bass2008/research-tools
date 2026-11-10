import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';
import { forLocale } from '@/lib/matrixMap';
import { calculate } from '@/lib/matrix';
import { pointsOf } from '@/lib/pair/engine';
import { yearPoints } from '@/lib/yearMatrix';
import { MatrixMap } from '../MatrixMap';
import { linkPath, nodeSize, xy } from '../matrixMapGeometry';

let mockLocale: 'ru' | 'en' = 'ru';
const mockPush = jest.fn();
jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: mockLocale, t: (ru: string, en: string) => mockLocale === 'ru' ? ru : en, setLocale: jest.fn() }) }));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const points = pointsOf(calculate({ year: 1987, month: 6, day: 14 }, 'f'));
beforeEach(() => { jest.clearAllMocks(); mockLocale = 'ru'; });

it('keeps every computed point at the shared web position and adds the full age scale', async () => {
  await render(<MatrixMap points={points} />);
  expect(screen.getAllByTestId(/^matrix-age-tick-/)).toHaveLength(80);
  const map = forLocale('ru');
  for (const point of map.MAP_POINTS) {
    const dot = screen.getByTestId(`matrix-dot-${point.symbol}`);
    expect(Number(dot.props.cx)).toBeCloseTo(map.mapXY(point)[0]);
    expect(Number(dot.props.cy)).toBeCloseTo(map.mapXY(point)[1]);
  }
  expect(screen.getByTestId('matrix-summary').props.children).toBe([points.A, points.B, points.C, points.D, points.E].join(' · '));
  expect(screen.getByTestId('matrix-dot-E').props.fill).toEqual({ type: 0, payload: processColor('#0e8f88') });
  expect(screen.queryByTestId('matrix-point-P1')).toBeNull();
});

it('keeps circles separate, including the material-karma and relationship line points', () => {
  const placed = forLocale('ru').MAP_POINTS.map(point => ({ xy: xy(point.angle, point.radius), ...nodeSize(point, false) }));
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    expect(Math.hypot(a.xy[0] - b.xy[0], a.xy[1] - b.xy[1]) - a.radius - b.radius).toBeGreaterThan(4);
  }
});

it('does not put personal ages on the pair chart', async () => {
  await render(<MatrixMap points={points} variant="pair" />);
  expect(screen.queryByTestId('matrix-age-tick-0')).toBeNull();
  expect(screen.getByTestId('matrix-point-Q')).toBeTruthy();
});

it('selects a diagram point and keeps its arcanum link accessible', async () => {
  await render(<MatrixMap points={points} />);
  await fireEvent.press(screen.getByTestId('matrix-point-A'));
  await fireEvent.press(screen.getByRole('link', { name: `Портрет личности · ${points.A}` }));
  expect(mockPush).toHaveBeenCalledWith(`/encyclopedia/arcanum/${points.A}`);
});

it('renders the guide with letters, accepts both highlight key forms and links to its position', async () => {
  await render(<MatrixMap points={{}} highlight={['material_attitude', 'C', 'L']} />);
  expect(screen.queryByTestId('matrix-age-tick-0')).toBeNull();
  for (const symbol of ['Q', 'C', 'L']) expect(screen.getByTestId(`matrix-focus-${symbol}`)).toBeTruthy();
  expect(screen.queryByTestId('matrix-focus-A')).toBeNull();
  await fireEvent.press(screen.getByTestId('matrix-point-Q'));
  await fireEvent.press(screen.getByRole('link', { name: 'Отношение к материальному · Q' }));
  expect(mockPush).toHaveBeenCalledWith('/encyclopedia/position/material_attitude');
});

it.each(['ru', 'en'] as const)('uses the year frame, its three periods and model-provided links (%s)', async locale => {
  mockLocale = locale;
  const year = yearPoints({ y: 1987, m: 6, d: 14 }, 2026);
  await render(<MatrixMap points={{ ...year, J: 22 }} year links={[{ keys: ['B', 'P1'], color: '#0e8f88' }]} />);
  expect(screen.queryByTestId('matrix-point-J')).toBeNull();
  expect(screen.queryByTestId('matrix-age-tick-0')).toBeNull();
  expect(screen.getAllByTestId(/^matrix-point-/)).toHaveLength(12);
  expect(Number(screen.getByTestId('matrix-year-wheel').props.r)).toBe(96);
  expect(screen.getByTestId('matrix-cardinal-frame').props.d).toBe('M310.0 62.0 558.0 310.0 310.0 558.0 62.0 310.0z');
  expect(screen.getByTestId('matrix-link-0')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('matrix-point-P1'));
  expect(screen.getByRole('link', { name: `${locale === 'ru' ? 'январь–апрель' : 'January–April'} · ${year.P1}` })).toBeTruthy();
});

it('does not draw invalid paths for missing, single or coincident points', () => {
  const positions = new Map<string, [number, number]>([['A', [62, 310]], ['B', [310, 62]], ['C', [62, 310]]]);
  expect(linkPath(['missing', 'A'], positions)).toBe('');
  expect(linkPath(['A', 'C'], positions)).toBe('');
  expect(linkPath(['A', 'B'], positions)).toMatch(/^M62\.0,310\.0 Q/);
});
