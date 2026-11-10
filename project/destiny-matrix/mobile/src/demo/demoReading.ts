import type { Lang } from '@/lib/i18n/hosts';
import type { SectionOut } from '@/lib/publicSpec';
import { isMobileSections } from '@/lib/mobileContentContract';
import ru from './ru.json';
import en from './en.json';

export interface DemoReadingData {
  schemaVersion: 1;
  kind: 'automatic-personal-demo';
  locale: Lang;
  birth: '1992-08-12';
  sex: 'f';
  asOf: '2026-11-08';
  title: string;
  notice: string;
  periodNotice: string;
  points: Record<string, number>;
  highlights: { key: string; title: string; text: string }[];
  sections: SectionOut[];
}

function snapshot(value: unknown): DemoReadingData {
  const demo = value as DemoReadingData;
  if (demo?.kind !== 'automatic-personal-demo' || demo.birth !== '1992-08-12' || demo.sex !== 'f'
    || !isMobileSections(demo) || demo.sections.length !== 22 || new Set(demo.sections.map(section => section.key)).size !== 22 || demo.sections.some(section => section.locked)
    || !['ru', 'en'].includes(demo.locale)) throw new Error('Invalid bundled demo reading');
  return demo;
}
const readings: Record<Lang, DemoReadingData> = { ru: snapshot(ru), en: snapshot(en) };

/** A single public example, not an entitlement or a way to generate other paid readings. */
export function demoReading(locale: Lang): DemoReadingData { return readings[locale]; }
