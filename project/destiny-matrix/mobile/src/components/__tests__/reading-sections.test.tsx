import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { ChakraReadingRow, LongformReading } from '@/lib/readingTypes';
import { Chakra, Longform, ReadingSection } from '../ReadingSections';
import { DesignSurface, theme } from '../../state/Design';


jest.mock('../../state/AppState', () => ({ useApp: () => ({ locale: 'en', t: (_ru: string, en: string) => en }) }));
jest.mock('../AppLink', () => ({ AppLink: () => null, useNavigate: () => jest.fn() }));

it('renders each chakra card with its own caption and preserves the complete reading', async () => {
  const row: ChakraReadingRow = { key: 'test', title: 'Chakra title', topic: 'Chakra topic', heading: 'Shared meaning',
    paragraphs: ['First interpretation', 'Second interpretation', 'Practical step'], cells: [
      { column: 'physics', arcanum: 5, title: 'Physics', caption: 'Physical expression' },
      { column: 'energy', arcanum: 8, title: 'Energy', caption: 'Energy expression' },
      { column: 'emotions', arcanum: 13, title: 'Emotions', caption: 'Emotional expression' },
    ] };
  await render(<Chakra row={row} />);
  expect(screen.getAllByTestId(/^arcanum-image-/).map(image => image.props.testID)).toEqual(['arcanum-image-5', 'arcanum-image-8', 'arcanum-image-13']);
  for (const text of [row.title, row.topic, row.heading, ...row.paragraphs, ...row.cells.map(cell => cell.caption)]) expect(screen.getByText(text)).toBeTruthy();
});

it('keeps all role parts, interactions and conclusions alongside the new card imagery', async () => {
  const reading: LongformReading = { slug: '5', title: 'Reading', testId: 'reading', lead: 'Lead', rolesTitle: 'Roles', rolesLead: 'Role introduction',
    interactionsTitle: 'Connections', interactionsLead: 'Connections introduction', summary: 'Summary text', strength: 'Strength text', tension: 'Tension text', practice: 'Practice text',
    roles: [{ key: 'a', label: 'Portrait', question: 'How is this expressed?', arcanum: 5, title: 'The Hierophant',
      essence: 'Essence text', strength: 'Role strength', risk: 'Risk text', action: 'Action text' }],
    interactions: [{ key: 'a-b', title: 'Interaction title', roles: ['a'], paragraphs: ['Interaction paragraph'] }],
  };
  await render(<Longform value={reading} />);
  expect(screen.getAllByTestId(/^arcanum-image-/).map(image => image.props.testID)).toEqual(['arcanum-image-5']);
  for (const text of ['Lead', 'How is this expressed?', 'Essence text', 'Role strength', 'Risk text', 'Action text', 'Interaction paragraph', 'Summary text', 'Strength text', 'Tension text', 'Practice text']) expect(screen.getByText(text)).toBeTruthy();
});

it('keeps private titles and interpretations out of a locked chapter', async () => {
  
  await render(<ReadingSection section={{ key: 'money', title: 'Money', lead: 'PRIVATE LEAD', access: 'paid', locked: true,
    positions: [{ arcanum: 5, label: 'Public position', href: '/encyclopedia/arcanum/5', text: 'PRIVATE TEXT',
      role: { key: 'a', arcanum: 5, label: 'PRIVATE ROLE', question: 'PRIVATE QUESTION', title: 'PRIVATE TITLE', essence: 'PRIVATE ESSENCE', strength: '', risk: '', action: '' } }] }} />);
  await fireEvent.press(screen.getByTestId('section-money'));
  expect(screen.getByTestId('arcanum-card-5-0')).toBeTruthy();
  for (const text of ['PRIVATE LEAD', 'PRIVATE TEXT', 'PRIVATE ROLE', 'PRIVATE QUESTION', 'PRIVATE TITLE', 'PRIVATE ESSENCE']) expect(screen.queryByText(text)).toBeNull();
});

function contrast(foreground: string, background: string) {
  const luminance = (hex: string) => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

it('keeps chapter labels and expand controls legible on paper', async () => {
  
  await render(<DesignSurface kind="canvas"><ReadingSection number={1} open section={{
    key: 'character', title: 'Character', lead: '', access: 'free', locked: false,
    positions: [{ arcanum: 5, label: 'Position meaning', href: '/encyclopedia/arcanum/5', text: 'Interpretation body' }],
  }} /></DesignSurface>);
  for (const label of ['Chapter 01', 'Position meaning · 5', '−']) {
    const style = StyleSheet.flatten(screen.getByText(label).props.style);
    expect(contrast(style.color, theme.paper)).toBeGreaterThanOrEqual(4.5);
  }
});
