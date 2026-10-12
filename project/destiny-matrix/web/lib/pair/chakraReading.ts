// Тексты чакр пары лежат в корпусе пары юнитами `chakra:<чакра>:<физика-энергия-эмоции>`:
// доступ, предпросмотр и печать идут по тем же правилам, что у остальных сфер.
import { chakraAtlas } from "../i18n/dict/chakraAtlas";
import { DP } from "../i18n/dict/pair";
import type { Lang as Locale } from "../i18n/lang";
import { forLocale as localizedPublicLabels } from "../i18n/publicLabels";
import { forLocale as localizedMatrix } from "../matrix";
import { filler } from "../lockedText";
import { ENERGY_FIELD_KEY, type ChakraReadingRow, type LongformReading } from "../readingTypes";
import { pairChakras, type PairChakraRow } from "./chakras";
import type { PairUnit } from "./spheres";

const columns = ["physics", "energy", "emotions"] as const;

export const chakraUnitKey = (key: string, row: Pick<PairChakraRow, "physics" | "energy" | "emotions">) =>
  `chakra:${key}:${row.physics}-${row.energy}-${row.emotions}`;

export function pairChakraMap(locale: Locale, dates: { a: string; b: string }) {
  const { calculate } = localizedMatrix(locale);
  return pairChakras(calculate(dates.a), calculate(dates.b));
}

/** Ключи текстов всех семи чакр и энергополя этой пары: числа, по которым дату не восстановить. */
export function pairChakraKeys(locale: Locale, dates: { a: string; b: string }): string[] {
  const { rows, totals } = pairChakraMap(locale, dates);
  return [...rows.map((row) => chakraUnitKey(row.key, row)), chakraUnitKey(ENERGY_FIELD_KEY, totals)];
}

/** Подробный раздел в том же виде, что личный: строки от Муладхары к Сахасраре и энергополе. */
export function pairChakraReading(locale: Locale, dates: { a: string; b: string },
  units: Record<string, PairUnit | null>): LongformReading {
  const { columnTitle } = localizedPublicLabels(locale);
  const { rows, totals } = pairChakraMap(locale, dates);
  const topics = DP.chakras.topics as Record<string, Record<Locale, string>>;
  const build = (key: string, title: string, row: Pick<PairChakraRow, "physics" | "energy" | "emotions">): ChakraReadingRow => {
    const unit = units[chakraUnitKey(key, row)];
    if (!unit?.title || !Array.isArray(unit.text) || unit.text.length !== 3) {
      throw new Error(`Incomplete pair chakra corpus: ${locale} ${chakraUnitKey(key, row)}`);
    }
    const text = unit.text;
    return {
      key, title, topic: topics[key]?.[locale] ?? "",
      heading: unit?.title ?? "",
      paragraphs: text,
      cells: columns.map((column) => ({ column, title: columnTitle(column), arcanum: row[column], caption: unit?.captions?.[column] ?? "" })),
    };
  };
  const chakraRows = [...rows].reverse().map((row) => build(row.key, row.title, row));
  const energyField = build(ENERGY_FIELD_KEY, chakraAtlas.energyField[locale], totals);
  return {
    slug: "pair-chakras", title: DP.chakras.title[locale], lead: DP.chakras.intro[locale], testId: "pair-chakras-reading",
    layout: "chakras", rolesTitle: "", rolesLead: "", interactionsTitle: "", interactionsLead: "",
    roles: [], interactions: [], summary: "", strength: "", tension: "", practice: "",
    chakraRows, energyField,
    chakraNote: DP.chakras.note[locale],
  };
}

// Средняя форма написанных текстов чакр пары: заглушка под размытием выглядит как настоящий текст.
const LOCKED_SHAPE = { heading: 34, caption: 26, paragraphs: [400, 330, 400] };

/** Закрытый раздел: раскладка открытого разбора, тексты скрыты до покупки. */
export function lockedPairChakraReading(locale: Locale, dates: { a: string; b: string }): LongformReading {
  const units: Record<string, PairUnit> = {};
  for (const key of pairChakraKeys(locale, dates)) {
    units[key] = {
      unit: key,
      title: filler(LOCKED_SHAPE.heading, locale, 0),
      captions: Object.fromEntries(columns.map((column, i) => [column, filler(LOCKED_SHAPE.caption, locale, i + 2)])),
      text: LOCKED_SHAPE.paragraphs.map((length, i) => filler(length, locale, i, ".")),
    };
  }
  const reading = pairChakraReading(locale, dates, units);
  const lock = (row: ChakraReadingRow): ChakraReadingRow => ({ ...row, lockedLabel: DP.chakras.lockedRow[locale] });
  return {
    ...reading,
    testId: "pair-chakras-locked",
    chakraRows: reading.chakraRows?.map(lock),
    energyField: reading.energyField && lock(reading.energyField),
  };
}
