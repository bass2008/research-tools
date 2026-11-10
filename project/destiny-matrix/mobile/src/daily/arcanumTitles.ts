import titles from './arcanum-titles.json';

// Regenerate with: node mobile/scripts/generate-arcanum-titles.mjs
// Canonical parity is checked by web/lib/mobileDemo.test.ts.
export function arcanumTitle(locale: 'ru' | 'en', arcanum: number): string {
  if (!Number.isInteger(arcanum) || arcanum < 1 || arcanum > 22) {
    throw new RangeError('Arcanum title requires an integer from 1 to 22');
  }
  return titles[locale][arcanum - 1];
}
