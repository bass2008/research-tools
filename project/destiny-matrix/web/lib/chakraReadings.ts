import ru from "../content/ru/chakra-personal.json";
import en from "../content/en/chakra-personal.json";
import { CHAKRA_COLUMNS, chakraRow, type ChakraCorpus } from "./chakraRow";
import { chakraAtlas } from "./i18n/dict/chakraAtlas";
import type { Lang } from "./i18n/lang";
import type { Matrix } from "./matrix";
import { ENERGY_FIELD_KEY, type LongformReading } from "./readingTypes";

/** Серверная сборка: совпадение одного числа не даёт права подставлять чужой текст. */
export function buildChakraReading(matrix: Matrix, locale: Lang, slug: string, title: string): LongformReading {
  const corpus: ChakraCorpus = locale === "ru" ? ru : en;
  const triple = (row: Matrix["chakras"][number]) => CHAKRA_COLUMNS.map((column) => row[column]);
  const totals = CHAKRA_COLUMNS.map((column) => matrix.chakra_totals[column]);
  const field = corpus.energy_field?.readings[totals.join("-")];

  return {
    slug, title, lead: corpus.intro, testId: "chakras-reading", layout: "chakras",
    rolesTitle: "", rolesLead: "", interactionsTitle: "", interactionsLead: "",
    roles: [], interactions: [], summary: "", strength: "", tension: "", practice: "",
    chakraRows: [...matrix.chakras].reverse().map((row) => {
      const numbers = triple(row);
      const copy = corpus.chakras[row.key]?.readings[numbers.join("-")] ?? corpus.empty_reading;
      return chakraRow(corpus, locale, row.key, row.title, numbers, copy);
    }),
    energyField: field && {
      ...chakraRow(corpus, locale, ENERGY_FIELD_KEY, chakraAtlas.energyField[locale], totals, field),
      topic: chakraAtlas.energyFieldTopic[locale],
    },
    chakraNote: corpus.note,
  };
}
