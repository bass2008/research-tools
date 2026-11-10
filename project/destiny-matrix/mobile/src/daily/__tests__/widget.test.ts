import { expect, it } from '@jest/globals';
import { monthPoints } from '@/lib/yearMatrix';
import { widgetModel } from '../widgetModel';
import { selectionForDate } from '../calendar';
import { dailyContent } from '../content';
import { arcanumTitle } from '../arcanumTitles';

it.each(['ru', 'en'] as const)('uses the same local theme as Today in %s', locale => {
  const now = new Date(2026, 10, 9, 23, 59);
  const model = widgetModel(now, locale);
  expect(model.arcanum).toBe(selectionForDate(now).arcanum);
  expect(model.title).toBe(dailyContent(locale, model.arcanum).title);
  expect(model.cardTitle).toBe(`${model.arcanum} · ${arcanumTitle(locale, model.arcanum)}`);
  expect(model.month).toBe('');
  expect(model.uri).toBe('arcanasense:///');
  expect(widgetModel(new Date(2026, 10, 10), locale).arcanum).not.toBe(model.arcanum);
});

it('changes the personal month at the month boundary and never exposes the birth date', () => {
  const birth = '1987-06-14';
  const before = widgetModel(new Date(2026, 10, 30, 23, 59), 'ru', birth);
  const after = widgetModel(new Date(2026, 11, 1), 'ru', birth);
  const n = monthPoints({ y: 1987, m: 6, d: 14 }, 2026, 12).E;
  expect(after.month).toBe(`Аркан месяца ${n} · ${arcanumTitle('ru', n)}`);
  expect(after.month).not.toBe(before.month);
  expect(JSON.stringify(after)).not.toContain(birth);
});
