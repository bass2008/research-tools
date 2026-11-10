import { describe, expect, it } from '@jest/globals';
import { dailyContent } from '../content';
import { arcanumTitle } from '../arcanumTitles';

const numbers = Array.from({ length: 22 }, (_, i) => i + 1);
const locales = ['ru', 'en'] as const;

describe.each(locales)('offline daily content (%s)', locale => {
  it.each(numbers)('provides a complete, readable topic for arcanum %i', number => {
    const topic = dailyContent(locale, number);
    expect(topic.title.trim()).not.toBe('');
    expect(topic.title.length).toBeLessThanOrEqual(45);
    expect(topic.question).toMatch(/\?$/);
    expect(topic.question.length).toBeLessThanOrEqual(100);
    expect(topic.paragraphs).toHaveLength(2);
    const words = topic.paragraphs.join(' ').trim().split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(60);
    expect(words).toBeLessThanOrEqual(100);
    expect(topic.paragraphs.every(paragraph => paragraph.trim().length > 100)).toBe(true);
    expect(topic.action.trim().length).toBeGreaterThan(20);
    // These fields render as plain text and must be readable with no network.
    expect([topic.title, topic.question, ...topic.paragraphs, topic.action].join(' '))
      .not.toMatch(/https?:\/\/|<\/?[a-z][^>]*>|\*\*|\[[^\]]+\]\(/i);
  });

  it('gives each card a distinct topic, question and exercise', () => {
    const entries = numbers.map(number => dailyContent(locale, number));
    for (const key of ['title', 'question', 'action'] as const) {
      expect(new Set(entries.map(entry => entry[key])).size).toBe(22);
    }
    expect(new Set(entries.flatMap(entry => entry.paragraphs)).size).toBe(44);
  });
});

it('keeps product numbering instead of the source books’ 8/11/0 numbering', () => {
  expect(dailyContent('ru', 8).paragraphs[0]).toContain('Справедливость');
  expect(dailyContent('en', 8).paragraphs[0]).toContain('Justice');
  expect(dailyContent('ru', 11).paragraphs[0]).toContain('Сила');
  expect(dailyContent('en', 11).paragraphs[0]).toContain('Strength');
  expect(dailyContent('ru', 22).paragraphs[0]).toContain('Шут');
  expect(dailyContent('en', 22).paragraphs[0]).toContain('The Fool');
});

it.each([0, 23, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  'rejects an invalid card number (%s), including the source Fool number 0', number => {
    expect(() => dailyContent('ru', number)).toThrow(RangeError);
    expect(() => dailyContent('en', number)).toThrow(RangeError);
    expect(() => arcanumTitle('ru', number)).toThrow(RangeError);
    expect(() => arcanumTitle('en', number)).toThrow(RangeError);
  },
);
