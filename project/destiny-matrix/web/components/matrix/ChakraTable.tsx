"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import ArcanumCard from "./ArcanumCard";
import SaveMatrixButton from "./SaveMatrixButton";
import UnlockCta from "@/components/pay/UnlockCta";
import LockIcon from "@/components/ui/LockIcon";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import { chakraAtlas as copy } from "@/lib/i18n/dict/chakraAtlas";
import { SITE_LANG as defaultLocale, type Lang } from "@/lib/i18n/lang";
import { forLocale as localizedPublicLabels } from "@/lib/i18n/publicLabels";
import type { Matrix } from "@/lib/matrix";
import { ENERGY_FIELD_HREF, ENERGY_FIELD_KEY, type LongformReading } from "@/lib/readingTypes";
import { forLocale as localizedSite } from "@/lib/site";
import { DEFAULT_SITE, type SiteProfile } from "@/lib/siteProfile";
import styles from "./ChakraTable.module.css";

const columns = ["physics", "energy", "emotions"] as const;
const palettes: Record<string, string[]> = {
  muladhara: ["#f2e2e1", "#864e4c", "#c3938f", "#e5ccca"],
  svadhisthana: ["#f5e7dc", "#845639", "#cba081", "#e9d6c5"],
  manipura: ["#f4eed8", "#725c2a", "#c3ab68", "#e8debd"],
  anahata: ["#e5eee5", "#41614a", "#92ae95", "#d2e0d0"],
  vishuddha: ["#e1f0f5", "#306477", "#86b5c4", "#cde2e9"],
  ajna: ["#e5e9f5", "#40557c", "#8d9fc5", "#d4dced"],
  sahasrara: ["#ece5f3", "#604772", "#a68abb", "#ded2e9"],
  [ENERGY_FIELD_KEY]: ["#e4efed", "#2f5d58", "#86b3ab", "#cfe2de"],
};
function theme(key: string): CSSProperties {
  return Object.fromEntries(["--tone", "--ink", "--accent", "--edge"].map((name, i) => [name, palettes[key]?.[i]]));
}
function RichText({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**")
    ? <strong key={i}>{part.slice(2, -2)}</strong> : part);
}

export interface ChakraTableProps {
  m: Matrix;
  title?: string;
  heading?: "h2" | "h3";
  printing?: boolean;
  locale?: Lang;
  site?: SiteProfile;
  /** Только данные раздела, который уже разрешил сервер. Корпус здесь не импортируется. */
  reading?: LongformReading;
  unlocked?: boolean;
  matrixId?: number | null;
  reportHref?: string;
  /** В каталоге матриц строки ведут в общие статьи, как и прежняя таблица. */
  referenceOnly?: boolean;
}

export default function ChakraTable({ m, title, heading: Heading = "h3", printing = false,
  locale: L = defaultLocale, site = DEFAULT_SITE, reading, unlocked = false,
  matrixId, reportHref, referenceOnly = false }: ChakraTableProps) {
  const { arcanumTitle } = localizedArcana(L);
  const { columnTitle } = localizedPublicLabels(L);
  const { publicHref } = localizedSite(L, site);
  const [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const rows = [...m.chakras].reverse();
  const field: Matrix["chakras"][number] = { key: ENERGY_FIELD_KEY, title: copy.energyField[L], hint: "", ...m.chakra_totals };
  const row = selected === ENERGY_FIELD_KEY ? field : rows.find((item) => item.key === selected);
  // Даже при быстрой смене даты не показываем текст предыдущей комбинации.
  const detail = unlocked && row ? (row.key === ENERGY_FIELD_KEY ? [reading?.energyField] : reading?.chakraRows)
    ?.find((item) => item?.key === row.key
      && columns.every((column) => item.cells.find((cell) => cell.column === column)?.arcanum === row[column])) : undefined;
  // A reading without a field text means the locale has no corpus for it, not that the date is unsaved.
  const fieldMissing = row?.key === ENERGY_FIELD_KEY && !!reading?.chakraRows && !reading.energyField;
  const href = (path: string) => printing ? publicHref(path) : path;
  const locked = !unlocked && !referenceOnly;

  useEffect(() => {
    if (!selected || !dialog.current) return;
    const node = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    node.showModal();
    node.scrollTop = 0;
    document.body.style.overflow = "hidden";
    return () => {
      node.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [selected]);
  useEffect(() => { setSelected(null); }, [m.birth, m.sex, L, unlocked]);

  const label = (item: Matrix["chakras"][number]) => `${item.title}. ${columns.map((column) =>
    `${columnTitle(column)}: ${item[column]} · ${arcanumTitle(item[column])}`).join(", ")}. ${locked ? copy.locked[L] : copy.read[L]}`;

  function renderRow(item: Matrix["chakras"][number], index: string) {
    const isField = item.key === ENERGY_FIELD_KEY;
    const content = <>
      <span className={styles.label}>
        <span className={styles.index}>{index}</span>
        <strong className={styles.name}>{isField ? copy.energyFieldShort[L] : item.title}</strong>
      </span>
      <span className={styles.cards}>
        {columns.map((column) => <span className={styles.card} key={column} data-column={column} data-arcanum={item[column]}
          title={`${columnTitle(column)}: ${item[column]} · ${arcanumTitle(item[column])}`}>
          <ArcanumCard locale={L} n={item[column]} size="mini" decorative half={printing} eager />
          <span className={styles.cardCopy}><b>{item[column]}</b><span>{arcanumTitle(item[column])}</span></span>
        </span>)}
      </span>
      {locked && !printing ? <span className={styles.lock}><LockIcon /></span> : null}
    </>;
    const props = { className: styles.row, style: theme(item.key),
      ...(isField ? { "data-energy-field": "" } : { "data-chakra": item.key }),
      "data-chakra-row": printing ? undefined : item.key, "aria-label": label(item) };
    const article = isField ? ENERGY_FIELD_HREF : `/encyclopedia/chakra/${item.key}`;
    return printing ? <div key={item.key} {...props}>{content}</div>
      : referenceOnly || reportHref ? <Link key={item.key} {...props} href={reportHref ?? article}>{content}</Link>
      : <button key={item.key} {...props} type="button" aria-haspopup="dialog" onClick={() => setSelected(item.key)}>{content}</button>;
  }

  return (
    <div className={`panel ${styles.panel} ${title ? styles.example : ""}`} data-testid="chakra-atlas" data-access={referenceOnly ? "reference" : locked ? "locked" : "open"}>
      <div className={styles.heading}>
        <Heading>{title ?? copy.title[L]}</Heading>
        <span className={styles.date}>{m.birth.split("-").reverse().join(".")}</span>
      </div>
      <p className={styles.lead}>{printing ? copy.printLead[L] : referenceOnly ? copy.referenceLead[L] : locked ? copy.lockedLead[L] : copy.lead[L]}</p>
      <div className={styles.columns} aria-hidden="true">
        <span>{copy.chakra[L]}</span><span>{columns.map((column) => <span key={column}>{columnTitle(column)}</span>)}</span>
      </div>
      <div className={styles.list}>
        {rows.map((item, index) => renderRow(item, String(index + 1).padStart(2, "0")))}
        {renderRow(field, "Σ")}
      </div>
      <div className={styles.footer}>
        {!printing ? <button type="button" onClick={() => setSelected("origin")} aria-haspopup="dialog">{copy.origin[L]}</button> : null}
      </div>

      {!printing ? <dialog ref={dialog} className={styles.dialog} style={theme(row?.key ?? "muladhara")}
        data-testid="chakra-dialog" data-chakra={row?.key} aria-labelledby={titleId}
        onClose={() => setSelected(null)} onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSelected(null);
        }}>
        <div className={styles.dialogTop}>
          <h2 id={titleId}>{row?.title ?? copy.origin[L]}</h2>
          {row ? <p>{detail?.topic ? `${detail.topic} · ` : ""}{columns.map((column) => row[column]).join(" / ")}</p> : null}
          <button type="button" className={styles.close} onClick={() => setSelected(null)} aria-label={copy.close[L]}>×</button>
        </div>
        <div className={styles.dialogContent}>
          {selected === "origin" ? <>
            <p>{copy.originLead[L]}</p><p>{copy.reduction[L]}</p>
            {rows.map((item) => <div className={styles.originRow} key={item.key}>
              <h3>{item.title} · {columns.map((column) => item[column]).join(" / ")}</h3>
              <p>{copy.sources[item.key as keyof typeof copy.sources][L]}</p>
              <p>{columnTitle("emotions")}: {item.physics} + {item.energy} = {item.physics + item.energy}
                {item.physics + item.energy !== item.emotions ? ` → ${item.emotions}` : ""}</p>
            </div>)}
            <h3>{copy.energyField[L]}</h3>
            {columns.map((column) => <p key={column}>{columnTitle(column)}: {rows.map((item) => item[column]).join(" + ")} → {m.chakra_totals[column]}</p>)}
          </> : row ? <>
            {detail?.heading ? <h3>{detail.heading}</h3> : null}
            <div className={styles.dialogCards}>
              {columns.map((column) => <figure key={column}>
                <span className={styles.role}>{columnTitle(column)}</span>
                <Link href={href(`/encyclopedia/arcanum/${row[column]}`)}><ArcanumCard locale={L} n={row[column]} size="big" eager /></Link>
                <figcaption><strong>{row[column]} · {arcanumTitle(row[column])}</strong>
                  {detail?.cells.find((cell) => cell.column === column)?.caption}
                </figcaption>
              </figure>)}
            </div>
            {locked ? <div className={styles.lockedCopy} data-testid="chakra-locked">
              <p><LockIcon /> {copy.locked[L]}</p><p>{copy.unlockHint[L]}</p>
              <UnlockCta locale={L} place="report" section="chakras" matrixId={matrixId}>{D.nav.buy[L]}</UnlockCta>
            </div> : fieldMissing ? null : detail ? <div className={styles.copy} data-testid="chakra-copy" data-empty={detail.paragraphs.every((text) => !text) || undefined}>
              {detail.paragraphs.map((text, index) => <p key={index}><RichText text={text} /></p>)}
            </div> : <div className={styles.lockedCopy}>
              <p>{copy.openSaved[L]}</p>
              <SaveMatrixButton locale={L} birth={m.birth} sex={m.sex} label={D.unlockBox.saveAndOpen[L]} />
            </div>}
            {detail && reading?.chakraNote ? <p className={styles.note}>{reading.chakraNote}</p> : null}
          </> : null}
        </div>
      </dialog> : null}
    </div>
  );
}
