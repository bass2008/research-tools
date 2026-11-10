import fs from 'node:fs';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { forLocale as matrixForLocale } from './matrix';
import { forLocale as sectionsForLocale } from './sections';
import { pointsOf } from './pair/engine';
import { isMobileSections } from './mobileContentContract';
import { forLocale as arcanaForLocale } from './arcana';

it.each(['ru', 'en'] as const)('the bundled %s arcanum titles match the canonical catalog', locale => {
  const titles = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '../mobile/src/daily/arcanum-titles.json'), 'utf8'));
  expect(Object.keys(titles).sort()).toEqual(['en', 'ru']);
  expect(titles[locale]).toEqual(Array.from({ length: 22 }, (_, i) => arcanaForLocale(locale).arcanumTitle(i + 1)));
});

it.each(['ru', 'en'] as const)('the bundled %s demo is exactly one complete automatic reading', locale => {
  const demo = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `../mobile/src/demo/${locale}.json`), 'utf8'));
  vi.useFakeTimers(); vi.setSystemTime(new Date(`${demo.asOf}T12:00:00.000Z`));
  try {
    const matrix = matrixForLocale(locale).calculate('1992-08-12', 'f');
    const source = sectionsForLocale(locale);
    const canonical = source.withPositionArticles(matrix, source.build(matrix, true));
    expect(demo.kind).toBe('automatic-personal-demo');
    expect(demo.locale).toBe(locale);
    expect(demo.birth).toBe(matrix.birth);
    expect(demo.points).toEqual(pointsOf(matrix));
    expect(demo.sections).toEqual(canonical);
    expect(demo.sections).toHaveLength(22);
    const parentChild = demo.sections.find((section: { key: string }) => section.key === 'parent_child_line');
    expect(parentChild.tripleReading.cells.map((cell: { column: string }) => cell.column)).toEqual(['A', 'O', 'J']);
    expect(parentChild.tripleReading.paragraphs).toHaveLength(3);
    expect(isMobileSections(demo)).toBe(true);
    for (const highlight of demo.highlights) {
      const section = canonical.find(row => row.key === highlight.key)!;
      expect(highlight.title).toBe(section.title);
      expect(highlight.text).toBe(section.longform?.summary);
    }
    expect(demo.article).toBeUndefined();
    expect(JSON.stringify(demo)).not.toContain('Добродетель, которой нет в колоде');
    expect(JSON.stringify(demo)).not.toContain('The virtue missing from the deck');
  } finally { vi.useRealTimers(); }
});
