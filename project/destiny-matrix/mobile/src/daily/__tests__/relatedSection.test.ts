import { expect, it } from '@jest/globals';
import { dailyRelatedSection } from '../relatedSection';
import { demoReading } from '../../demo/demoReading';
import { internalTarget } from '../../native/navigation';

it.each(['ru', 'en'] as const)('links all 22 %s themes to real unlocked bundled chapters through native routes', locale => {
  for (let n = 1; n <= 22; n++) {
    const related = dailyRelatedSection(locale, n);
    const section = demoReading(locale).sections.find(section => section.key === related.key);
    expect(section).toBeDefined(); expect(section!.locked).not.toBe(true);
    expect(section!.title).toBe(related.title); expect(section!.lead.length).toBeGreaterThan(20);
    expect(internalTarget(related.href)).toEqual({ locale: undefined, path: related.href });
    expect(dailyRelatedSection(locale === 'ru' ? 'en' : 'ru', n).key).toBe(related.key);
  }
});

it.each([0, 23, -1, 1.5, NaN, Infinity])('rejects an invalid daily arcanum: %s', n => {
  expect(() => dailyRelatedSection('en', n)).toThrow(RangeError);
});
