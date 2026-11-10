import { expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { forLocale as mapForLocale } from '@/lib/matrixMap';
import type { SectionOut } from '@/lib/publicSpec';
import type { ReadingItem } from '@/lib/api';
import definitions from '../section-points.json';
import articles from '../position-articles.json';
import { chapterForPoint, matchingReading, pointArticle } from '../personalReading';

it('keeps only keys and selectors from the canonical sections, never paid labels', () => {
  const spec = JSON.parse(readFileSync(path.join(__dirname, '../../../../spec/sections.json'), 'utf8'));
  const expected = Object.fromEntries(spec.sections
    .filter((section: { positions: { expand?: string }[] }) => !section.positions.some(p => p.expand))
    .map((section: { key: string; positions: { selector: string; position_key: string }[] }) => [section.key,
      section.positions.map(({ selector, position_key }) => ({ selector, position_key }))]));
  expect(definitions).toEqual(expected);
});

it.each(['ru', 'en'] as const)('only uses existing %s encyclopedia crossings', locale => {
  const registry = JSON.parse(readFileSync(path.join(__dirname, `../../../../web/content/${locale}/position-arcanum.json`), 'utf8'));
  expect(articles[locale]).toEqual(registry.items.map((r: { position: string; arcanum: number }) => `${r.position}/${r.arcanum}`));
  expect(pointArticle(locale, 'center', 9)).toBe('/encyclopedia/position/center/9');
  expect(pointArticle(locale, 'anahata_physics', 9)).toBe('/encyclopedia/arcanum/9');
});

it('maps locked chapters by selector and slot even when several points have the same number', () => {
  const point = mapForLocale('ru').MAP_POINTS.find(p => p.symbol === 'F')!;
  const position = { label: 'Supplied label', arcanum: 9, href: '/encyclopedia/arcanum/9' };
  const sections: SectionOut[] = [
    { key: 'comfort', title: 'Free', lead: '', access: 'free', positions: [position, position, position] },
    { key: 'parents_children', title: 'Locked', lead: '', access: 'paid', locked: true,
      positions: [position, position, position] },
  ];
  expect(chapterForPoint(sections, point, 9)?.key).toBe('parents_children');
  expect(chapterForPoint(sections, point, 8)).toBeUndefined();
  expect(chapterForPoint([{ ...sections[1], positions: [position] }], point, 9)).toBeUndefined();
});

it('never associates another date, sex, expired or locked purchase with my reading', () => {
  const row = { id: 1, product: 'personal', birth: '1987-06-14', sex: 'f', inputs: {},
    unlocked: true, access_until: null } as ReadingItem;
  const me = { birth: row.birth!, sex: 'f' as const };
  expect(matchingReading([row], me)).toBe(row);
  for (const change of [{ birth: '1987-06-15' }, { sex: 'm' }, { product: 'pair' },
    { unlocked: false }, { access_until: '2020-01-01T00:00:00Z' }]) {
    expect(matchingReading([{ ...row, ...change } as ReadingItem], me)).toBeUndefined();
  }
});
