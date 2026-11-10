import type { ReadingItem } from '@/lib/api';
import type { SectionOut } from '@/lib/publicSpec';
import type { MapPoint } from '@/lib/matrixMap';
import type { Lang } from '@/lib/i18n/hosts';
import definitions from './section-points.json';
import articles from './position-articles.json';
import type { MyDate } from '../state/Me';

export interface ReportParams {
  birth?: string; sex?: string; id?: string; slug?: string;
  point?: string; chapter?: string; selection?: string;
}

export function chapterTitle(title: string) {
  return title.replace(/ в матрице судьбы$/i, '').replace(/ in the destiny matrix$/i, '')
    .replace('Чакры: карта энергий, толкование семи уровней', 'Чакры: карта энергий')
    .replace('Chakras: the energy map, reading the seven levels', 'Chakras: the energy map');
}

export function chapterHref(params: ReportParams, chapter: string) {
  const query = new URLSearchParams({ chapter });
  for (const key of ['id', 'birth', 'sex', 'slug'] as const) {
    if (params[key]) query.set(key, params[key]!);
  }
  return `/encyclopedia/reading?${query}`;
}

export function personalReaderKey(params: ReportParams, userId?: number) {
  return JSON.stringify([userId ?? null, params.id, params.birth, params.sex, params.slug]);
}

export function matchingReading(rows: ReadingItem[], me: MyDate) {
  return rows.find(row => row.product === 'personal'
    && (row.birth ?? row.inputs.birth) === me.birth
    && (row.sex ?? row.inputs.sex) === me.sex && row.unlocked
    && (!row.access_until || Date.parse(row.access_until) > Date.now()));
}

export function chapterForPoint(sections: SectionOut[], point: MapPoint, n: number) {
  const catalog = definitions as Record<string, { selector: string; position_key: string }[]>;
  return sections.find(section => section.positions.some((position, index) => {
    if ('key' in position) return position.key === point.key;
    // The current BFF omits keys. Match the canonical selector and slot, never the number alone.
    const rows = catalog[section.key];
    return rows?.length === section.positions.length && rows[index].selector === point.symbol
      && position.arcanum === n;
  }));
}

export function pointArticle(locale: Lang, key: string, n: number) {
  return articles[locale].includes(`${key}/${n}`)
    ? `/encyclopedia/position/${key}/${n}` : `/encyclopedia/arcanum/${n}`;
}
