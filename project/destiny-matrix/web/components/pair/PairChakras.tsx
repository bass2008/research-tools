"use client";

import type { ReactNode } from "react";
import type { LongformReading } from "@/lib/readingTypes";
import ChakraAtlas, { columns, type AtlasRow } from "@/components/matrix/ChakraAtlas";
import styles from "@/components/matrix/ChakraTable.module.css";
import LockIcon from "@/components/ui/LockIcon";
import RichText from "@/components/ui/RichText";
import { chakraAtlas as copy } from "@/lib/i18n/dict/chakraAtlas";
import { DP } from "@/lib/i18n/dict/pair";
import type { Lang as Locale } from "@/lib/i18n/lang";
import { forLocale as localizedPublicLabels } from "@/lib/i18n/publicLabels";
import { forLocale as localizedMatrix, fold } from "@/lib/matrix";
import { pairChakras } from "@/lib/pair/chakras";
import { ENERGY_FIELD_KEY } from "@/lib/readingTypes";

export default function PairChakras({ locale: L, dates, locked, printing = false, cta, reading }: {
  locale: Locale;
  dates: { a: string; b: string };
  locked: boolean;
  printing?: boolean;
  /** Purchase control of the couple reading, the same one the locked spheres use. */
  cta: ReactNode;
  /** Texts of the open reading; absent while locked. */
  reading?: LongformReading;
}) {
  const { columnTitle } = localizedPublicLabels(L);
  const { calculate, birthLabel } = localizedMatrix(L);
  const a = calculate(dates.a);
  const b = calculate(dates.b);
  const { rows, totals } = pairChakras(a, b);
  const ordered = [...rows].reverse();
  const field: AtlasRow = { key: ENERGY_FIELD_KEY, title: copy.energyField[L], ...totals };
  const personal = (m: typeof a, key: string) => m.chakras.find((item) => item.key === key)!;
  const textOf = (key: string) => key === ENERGY_FIELD_KEY ? reading?.energyField : reading?.chakraRows?.find((row) => row.key === key);
  const step = (x: number, y: number) => {
    const sum = x + y;
    return sum > 22 ? `${x} + ${y} = ${sum} → ${fold(sum)}` : `${x} + ${y} = ${sum}`;
  };

  return (
    <ChakraAtlas
      locale={L}
      rows={ordered}
      field={field}
      title={DP.chakras.title[L]}
      heading="h2"
      date={`${birthLabel(dates.a)} + ${birthLabel(dates.b)}`}
      lead={printing ? DP.chakras.printLead[L] : locked ? DP.chakras.lockedLead[L] : DP.chakras.lead[L]}
      printing={printing}
      locked={locked}
      tall
      href={(path) => path}
      resetKey={`${dates.a}|${dates.b}|${L}|${locked}`}
      testId="pair-chakras"
      id="pair-chakras"
      detail={(row) => {
        const text = locked ? undefined : textOf(row.key);
        return text ? { heading: text.heading || undefined, topic: text.topic,
          captions: Object.fromEntries(text.cells.map((cell) => [cell.column, cell.caption])) } : undefined;
      }}
      body={(row) => {
        const text = locked ? undefined : textOf(row.key);
        return locked ? <div className={styles.lockedCopy} data-testid="chakra-locked">
          <p><LockIcon /> {DP.chakras.locked[L]}</p><p>{DP.chakras.unlockHint[L]}</p>
          {cta}
        </div> : <div className={styles.copy} data-testid="chakra-copy">
            {text?.paragraphs.map((paragraph, index) => <p key={index}><RichText text={paragraph} /></p>)}
          </div>;
      }}
      origin={<>
        <p>{DP.chakras.originLead[L]}</p><p>{DP.chakras.reduction[L]}</p>
        {ordered.map((item) => <div className={styles.originRow} key={item.key}>
          <h3>{item.title} · {columns.map((column) => item[column]).join(" / ")}</h3>
          {columns.map((column) => <p key={column}>
            {columnTitle(column)}: {step(personal(a, item.key)[column], personal(b, item.key)[column])}</p>)}
        </div>)}
        <h3>{copy.energyField[L]}</h3>
        {columns.map((column) => {
          const sum = ordered.reduce((acc, item) => acc + item[column], 0);
          return <p key={column}>{columnTitle(column)}: {ordered.map((item) => item[column]).join(" + ")} = {sum} → {totals[column]}</p>;
        })}
      </>}
    />
  );
}
