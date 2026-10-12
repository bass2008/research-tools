"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import ArcanumCard from "./ArcanumCard";
import LockIcon from "@/components/ui/LockIcon";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { chakraAtlas as copy } from "@/lib/i18n/dict/chakraAtlas";
import type { Lang } from "@/lib/i18n/lang";
import { forLocale as localizedPublicLabels } from "@/lib/i18n/publicLabels";
import { ENERGY_FIELD_HREF, ENERGY_FIELD_KEY } from "@/lib/readingTypes";
import styles from "./ChakraTable.module.css";
import { chakraTheme as theme } from "./chakraTheme";

export const columns = ["physics", "energy", "emotions"] as const;
export type AtlasColumn = (typeof columns)[number];
export type AtlasRow = { key: string; title: string } & Record<AtlasColumn, number>;
export type AtlasDetail = { heading?: string; topic?: string; captions?: Partial<Record<AtlasColumn, ReactNode>> };

export interface ChakraAtlasProps {
  locale: Lang;
  /** Rows in display order; the energy field goes separately. */
  rows: AtlasRow[];
  field: AtlasRow;
  title: string;
  heading?: "h2" | "h3";
  date: string;
  lead: string;
  printing?: boolean;
  locked: boolean;
  referenceOnly?: boolean;
  reportHref?: string;
  /** Free-height panel, as on example pages. */
  tall?: boolean;
  href: (path: string) => string;
  /** Any change closes an open dialog: a new date must not show the previous combination. */
  resetKey: string;
  testId?: string;
  id?: string;
  detail: (row: AtlasRow) => AtlasDetail | undefined;
  body: (row: AtlasRow) => ReactNode;
  origin: ReactNode;
}

export default function ChakraAtlas({ locale: L, rows, field, title, heading: Heading = "h3", date, lead,
  printing = false, locked, referenceOnly = false, reportHref, tall = false, href, resetKey,
  testId = "chakra-atlas", id, detail, body, origin }: ChakraAtlasProps) {
  const { arcanumTitle } = localizedArcana(L);
  const { columnTitle } = localizedPublicLabels(L);
  const [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const row = selected === ENERGY_FIELD_KEY ? field : rows.find((item) => item.key === selected);
  const info = row ? detail(row) : undefined;
  const showLocks = locked && !referenceOnly;

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
  useEffect(() => { setSelected(null); }, [resetKey]);

  const label = (item: AtlasRow) => `${item.title}. ${columns.map((column) =>
    `${columnTitle(column)}: ${item[column]} · ${arcanumTitle(item[column])}`).join(", ")}. ${showLocks ? copy.locked[L] : copy.read[L]}`;

  function renderRow(item: AtlasRow, index: string) {
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
      {showLocks && !printing ? <span className={styles.lock}><LockIcon /></span> : null}
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
    <div className={`panel ${styles.panel} ${tall ? styles.example : ""}`} id={id} data-testid={testId}
      data-access={referenceOnly ? "reference" : locked ? "locked" : "open"}>
      <div className={styles.heading}>
        <Heading>{title}</Heading>
        <span className={styles.date}>{date}</span>
      </div>
      <p className={styles.lead}>{lead}</p>
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
          {row ? <p>{info?.topic ? `${info.topic} · ` : ""}{columns.map((column) => row[column]).join(" / ")}</p> : null}
          <button type="button" className={styles.close} onClick={() => setSelected(null)} aria-label={copy.close[L]}>×</button>
        </div>
        <div className={styles.dialogContent}>
          {selected === "origin" ? origin : row ? <>
            {info?.heading ? <h3>{info.heading}</h3> : null}
            <div className={styles.dialogCards}>
              {columns.map((column) => <figure key={column}>
                <span className={styles.role}>{columnTitle(column)}</span>
                <Link href={href(`/encyclopedia/arcanum/${row[column]}`)}><ArcanumCard locale={L} n={row[column]} size="big" eager /></Link>
                <figcaption><strong>{row[column]} · {arcanumTitle(row[column])}</strong>
                  {info?.captions?.[column]}
                </figcaption>
              </figure>)}
            </div>
            {body(row)}
          </> : null}
        </div>
      </dialog> : null}
    </div>
  );
}
