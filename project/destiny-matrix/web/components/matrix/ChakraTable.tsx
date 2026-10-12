"use client";

import ChakraAtlas, { columns, type AtlasRow } from "./ChakraAtlas";
import SaveMatrixButton from "./SaveMatrixButton";
import UnlockCta from "@/components/pay/UnlockCta";
import LockIcon from "@/components/ui/LockIcon";
import RichText from "@/components/ui/RichText";
import { D } from "@/lib/i18n";
import { chakraAtlas as copy } from "@/lib/i18n/dict/chakraAtlas";
import { SITE_LANG as defaultLocale, type Lang } from "@/lib/i18n/lang";
import { forLocale as localizedPublicLabels } from "@/lib/i18n/publicLabels";
import type { Matrix } from "@/lib/matrix";
import type { ChakraReadingStatus } from "@/lib/useChakraAccess";
import { ENERGY_FIELD_KEY, type LongformReading } from "@/lib/readingTypes";
import { forLocale as localizedSite } from "@/lib/site";
import { DEFAULT_SITE, type SiteProfile } from "@/lib/siteProfile";
import styles from "./ChakraTable.module.css";

export interface ChakraTableProps {
  m: Matrix;
  title?: string;
  heading?: "h2" | "h3";
  printing?: boolean;
  locale?: Lang;
  site?: SiteProfile;
  /** Только данные раздела, который уже разрешил сервер. Корпус здесь не импортируется. */
  reading?: LongformReading;
  readingStatus?: ChakraReadingStatus;
  unlocked?: boolean;
  matrixId?: number | null;
  reportHref?: string;
  /** В каталоге матриц строки ведут в общие статьи, как и прежняя таблица. */
  referenceOnly?: boolean;
}

export default function ChakraTable({ m, title, heading = "h3", printing = false,
  locale: L = defaultLocale, site = DEFAULT_SITE, reading, unlocked = false,
  matrixId, reportHref, referenceOnly = false, readingStatus }: ChakraTableProps) {
  const { columnTitle } = localizedPublicLabels(L);
  const { publicHref } = localizedSite(L, site);
  const rows = [...m.chakras].reverse();
  const field: AtlasRow = { key: ENERGY_FIELD_KEY, title: copy.energyField[L], ...m.chakra_totals };
  const locked = !unlocked && !referenceOnly;
  // Даже при быстрой смене даты не показываем текст предыдущей комбинации.
  const find = (row: AtlasRow) => unlocked ? (row.key === ENERGY_FIELD_KEY ? [reading?.energyField] : reading?.chakraRows)
    ?.find((item) => item?.key === row.key
      && columns.every((column) => item.cells.find((cell) => cell.column === column)?.arcanum === row[column])) : undefined;
  // A reading without a field text means the locale has no corpus for it, not that the date is unsaved.
  const fieldMissing = (row: AtlasRow) => row.key === ENERGY_FIELD_KEY && !!reading?.chakraRows && !reading.energyField;

  return (
    <ChakraAtlas
      locale={L}
      rows={rows}
      field={field}
      title={title ?? copy.title[L]}
      heading={heading}
      date={m.birth.split("-").reverse().join(".")}
      lead={printing ? copy.printLead[L] : referenceOnly ? copy.referenceLead[L] : locked ? copy.lockedLead[L] : copy.lead[L]}
      printing={printing}
      locked={locked}
      referenceOnly={referenceOnly}
      reportHref={reportHref}
      tall={!!title}
      href={(path) => printing ? publicHref(path) : path}
      resetKey={`${m.birth}|${m.sex}|${L}|${unlocked}`}
      detail={(row) => {
        const found = find(row);
        return found ? { heading: found.heading, topic: found.topic,
          captions: Object.fromEntries(found.cells.map((cell) => [cell.column, cell.caption])) } : undefined;
      }}
      body={(row) => {
        const detail = find(row);
        return <>
          {locked ? <div className={styles.lockedCopy} data-testid="chakra-locked">
            <p><LockIcon /> {copy.locked[L]}</p><p>{copy.unlockHint[L]}</p>
            <UnlockCta locale={L} place="report" section="chakras" matrixId={matrixId}
              birth={{ birth: m.birth, sex: m.sex }}>{D.nav.buy[L]}</UnlockCta>
          </div> : fieldMissing(row) ? null : detail ? <div className={styles.copy} data-testid="chakra-copy" data-empty={detail.paragraphs.every((text) => !text) || undefined}>
            {detail.paragraphs.map((text, index) => <p key={index}><RichText text={text} /></p>)}
          </div> : readingStatus ? <div className={styles.lockedCopy} role="status">
            <p>{readingStatus === "loading" ? D.common.loading[L] : copy.loadFailed[L]}</p>
          </div> : <div className={styles.lockedCopy}>
            <p>{copy.openSaved[L]}</p>
            <SaveMatrixButton locale={L} birth={m.birth} sex={m.sex} label={D.unlockBox.saveAndOpen[L]} />
          </div>}
          {detail && reading?.chakraNote ? <p className={styles.note}>{reading.chakraNote}</p> : null}
        </>;
      }}
      origin={<>
        <p>{copy.originLead[L]}</p><p>{copy.reduction[L]}</p>
        {rows.map((item) => <div className={styles.originRow} key={item.key}>
          <h3>{item.title} · {columns.map((column) => item[column]).join(" / ")}</h3>
          <p>{copy.sources[item.key as keyof typeof copy.sources][L]}</p>
          <p>{columnTitle("emotions")}: {item.physics} + {item.energy} = {item.physics + item.energy}
            {item.physics + item.energy !== item.emotions ? ` → ${item.emotions}` : ""}</p>
        </div>)}
        <h3>{copy.energyField[L]}</h3>
        {columns.map((column) => <p key={column}>{columnTitle(column)}: {rows.map((item) => item[column]).join(" + ")} → {m.chakra_totals[column]}</p>)}
      </>}
    />
  );
}
