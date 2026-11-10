import { monthPoints } from '@/lib/yearMatrix';
import { selectionForDate } from './calendar';
import { dailyContent } from './content';
import { arcanumTitle } from './arcanumTitles';

export function widgetModel(now: Date, locale: 'ru' | 'en', birth?: string) {
  const day = selectionForDate(now);
  let month = '';
  if (birth && /^\d{4}-\d{2}-\d{2}$/.test(birth)) {
    const [y, m, d] = birth.split('-').map(Number);
    const value = monthPoints({ y, m, d }, now.getFullYear(), now.getMonth() + 1).E;
    month = `${locale === 'ru' ? 'Аркан месяца' : 'Month arcanum'} ${value} · ${arcanumTitle(locale, value)}`;
  }
  return { arcanum: day.arcanum, title: dailyContent(locale, day.arcanum).title, month,
    cardTitle: `${day.arcanum} · ${arcanumTitle(locale, day.arcanum)}`,
    label: locale === 'ru' ? 'ТЕМА ДНЯ' : 'TODAY’S THEME', uri: 'arcanasense:///' };
}
