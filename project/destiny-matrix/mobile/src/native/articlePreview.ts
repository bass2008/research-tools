import { isMobileArticle, type MobileArticle } from '@/lib/mobileContentContract';

export const isPublicArticle = (value: unknown): value is MobileArticle =>
  isMobileArticle(value) && value.access === 'public';

export function articlePreview(article: MobileArticle | undefined, monthArcanum?: number) {
  if (!article || article.access !== 'public') return null;
  if (monthArcanum !== undefined) {
    const start = article.blocks.findIndex(block => block.type === 'heading'
      && new RegExp(`^${monthArcanum}\\s*[·.:]`).test(block.text));
    if (start < 0) return null;
    for (const block of article.blocks.slice(start + 1)) {
      if (block.type === 'heading') break;
      if (block.type === 'paragraph' && block.text.trim()) return block.text;
    }
    return null;
  }
  if (article.lead.trim()) return article.lead.split(/\n\s*\n/)[0];
  const paragraph = article.blocks.find(block => block.type === 'paragraph');
  return paragraph?.type === 'paragraph' ? paragraph.text : null;
}
