import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ArcanumCards } from '../ArcanumCards';

jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: 'en', t: (_ru: string, en: string) => en }) }));
jest.mock('../AppLink', () => ({ useNavigate: () => jest.fn() }));

it.each([2, 3] as const)('keeps %i cards within one row on screens with fractional layout widths', async columns => {
  await render(<ArcanumCards columns={columns} cards={Array.from({ length: columns }, (_, i) => ({ arcanum: i + 1, label: `Card ${i + 1}` }))} />);
  for (const width of [284.4, 339.80950927734375, 375.6, 390.42]) {
    await fireEvent(screen.getByTestId('arcanum-grid'), 'layout', { nativeEvent: { layout: { width, height: 250, x: 0, y: 0 } } });
    const cells = screen.getAllByTestId(/^arcanum-card-/);
    const used = cells.reduce((sum, cell) => sum + StyleSheet.flatten(cell.props.style).width, 0);
    const gap = StyleSheet.flatten(screen.getByTestId('arcanum-grid').props.style).gap;
    // Real Android regression: rounding the flex children's physical pixels used
    // to make an ostensibly exact-fit second card wrap into a single column.
    expect(used + gap * (columns - 1)).toBeLessThan(Math.floor(width));
    expect(cells).toHaveLength(columns);
    expect(screen.getAllByTestId(/^arcanum-image-/)).toHaveLength(columns);
  }
});
