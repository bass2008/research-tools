import { expect, it } from '@jest/globals';
import type { MobileArticle } from '@/lib/mobileContentContract';
import { articlePreview, isPublicArticle } from '../articlePreview';

const article: MobileArticle = { schemaVersion: 1, path: '/encyclopedia/month', locale: 'ru', title: 'Month',
  lead: 'General article lead', access: 'public', accessUntil: null, breadcrumbs: [], blocks: [
    { type: 'heading', level: 3, text: '8 · Справедливость' },
    { type: 'paragraph', text: 'Eight in a month' },
    { type: 'heading', level: 3, text: '18 · Луна' },
    { type: 'paragraph', text: 'Eighteen in a month' },
  ] };
it('selects the first paragraph for the exact monthly arcanum, with a safe fallback', () => {
  expect(articlePreview(article, 8)).toBe('Eight in a month');
  expect(articlePreview(article, 18)).toBe('Eighteen in a month');
  expect(articlePreview(article, 1)).toBeNull();
  expect(articlePreview(undefined, 8)).toBeNull();
  expect(articlePreview(article)).toBe('General article lead');
});
it('never admits private or locked content to a public preview', () => {
  expect(isPublicArticle({ ...article, access: 'private' })).toBe(false);
  expect(articlePreview({ ...article, access: 'locked' }, 8)).toBeNull();
});
