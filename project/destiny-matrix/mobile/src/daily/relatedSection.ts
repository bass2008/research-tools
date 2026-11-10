import type { Lang } from '@/lib/i18n/hosts';
import { demoReading } from '../demo/demoReading';

// Editorial topic links, not a calculation or a claim about the reader's chart.
const sections = [
  'realisation', 'comfort', 'resources', 'profession', 'family_gifts', 'relations',
  'purpose', 'relations', 'soul_tasks', 'loops', 'character', 'rest', 'realisation',
  'body_resource', 'loops', 'comfort', 'purpose', 'comfort', 'resources',
  'family_gifts', 'realisation', 'realisation',
] as const;

export function dailyRelatedSection(locale: Lang, arcanum: number) {
  if (!Number.isInteger(arcanum) || arcanum < 1 || arcanum > sections.length) throw new RangeError('Arcanum must be between 1 and 22');
  const key = sections[arcanum - 1];
  const section = demoReading(locale).sections.find(section => section.key === key);
  if (!section || section.locked) throw new Error('Related sample chapter is unavailable');
  return { key, title: section.title, href: `/encyclopedia/demo?view=reading&chapter=${key}` };
}
