import { Fragment, type ReactNode } from "react";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import { ChakraReadingBlock } from "@/components/matrix/ChakraReadingView";
import TocHeading, { TOC_MIN } from "@/components/enc/TocHeading";
import RichText from "@/components/ui/RichText";
import type { Paragraph, Section, Slot } from "@/lib/content";
import type { Lang } from "@/lib/i18n/lang";

export type Slots = Partial<Record<Slot, ReactNode>>;

// A karmic tail role table: «**M** — вход | 12 · Повешенный | …». Recognised by its cells, so the
// articles stay plain Markdown tables.
const ROLE_POINT = /^\*\*([A-Z])\*\*\s*—\s*(.+)$/;
const ROLE_ARCANUM = /^(\d{1,2})\s*·\s*([^(]+?)\s*(\(.+\))?$/;
const ROLE_FROM = /^(Откуда число|Where the number comes from)$/;
const ROLE_IMAGE = /^(Образ|Image)$/;

function isRoleTable({ head, rows }: { head: string[]; rows: string[][] }): boolean {
  return /^(Аркан|Arcanum)$/.test(head[1] ?? "") && rows.every((row) => ROLE_POINT.test(row[0]) && ROLE_ARCANUM.test(row[1]));
}

function RoleTable({ head, rows, locale }: { head: string[]; rows: string[][]; locale: Lang }) {
  return (
    <div className="tabscroll">
      <table className="postab roletab">
        <thead>
          <tr>{head.map((cell, i) => <th key={i} scope="col">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, r) => {
            const [, letter, label] = row[0].match(ROLE_POINT)!;
            const [, n, name, note] = row[1].match(ROLE_ARCANUM)!;
            return (
              <tr key={r} data-point={letter}>
                <td><span className="rt-pt"><span className={`rt-dot p${letter}`}>{letter}</span>{label}</span></td>
                <td>
                  <span className="rt-ac">
                    <ArcanumCard locale={locale} n={Number(n)} size="mini" decorative />
                    <span><b>{n} · {name}</b>{note ? <span className="rt-note">{note}</span> : null}</span>
                  </span>
                </td>
                {row.slice(2).map((cell, c) => {
                  const column = head[c + 2] ?? "";
                  return (
                    <td key={c} className={ROLE_IMAGE.test(column) ? "rt-img" : undefined}>
                      {ROLE_FROM.test(column) ? <span className="rt-chip">{cell}</span> : <RichText text={cell} />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SectionItem({ item, slots, locale }: { item: Exclude<Paragraph, { chakra_reading: unknown }>; slots?: Slots; locale: Lang }) {
  if (typeof item === "string") return <p><RichText text={item} /></p>;
  if ("h3" in item) return <h3>{item.h3}</h3>;
  if ("ul" in item) return <ul>{item.ul.map((text, i) => <li key={i}><RichText text={text} /></li>)}</ul>;
  if ("ol" in item) return <ol>{item.ol.map((text, i) => <li key={i}><RichText text={text} /></li>)}</ol>;
  if ("slot" in item) return <>{slots?.[item.slot] ?? null}</>;
  if (isRoleTable(item.table)) return <RoleTable head={item.table.head} rows={item.table.rows} locale={locale} />;
  return (
    <div className="tabscroll">
      <table className="postab">
        <thead>
          <tr>{item.table.head.map((cell, i) => <th key={i} scope="col">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {item.table.rows.map((row, r) => (
            <tr key={r}>{row.map((cell, c) => <td key={c}><RichText text={cell} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A chakra reading keeps the paid-report typography, so it closes the surrounding .prose.
export function Paragraphs({ items, head, slots, locale }: {
  items: Paragraph[]; head?: ReactNode; slots?: Slots; locale: Lang;
}) {
  const out: ReactNode[] = [];
  let prose: ReactNode[] = head ? [<Fragment key="head">{head}</Fragment>] : [];
  const flush = (key: number) => {
    if (prose.length) out.push(<div className="prose" key={`prose-${key}`}>{prose}</div>);
    prose = [];
  };
  items.forEach((item, i) => {
    if (typeof item === "string" || !("chakra_reading" in item)) {
      prose.push(<SectionItem key={i} item={item} slots={slots} locale={locale} />);
      return;
    }
    flush(i);
    const { id, number, note, row } = item.chakra_reading;
    out.push(<ChakraReadingBlock key={id} id={id} row={row} number={number} locale={locale} eager={false}
      titleTag="p" labelId={`${id}-title`} note={note ? <RichText text={note} /> : undefined} />);
  });
  flush(items.length);
  return <>{out}</>;
}

// Anchors stay unique across blocks on one page: a split list continues its numbering (start),
// a different list takes its own prefix.
export default function Sections({ items, slots, locale, idPrefix = "s", start = 0 }: {
  items: Section[]; slots?: Slots; locale: Lang; idPrefix?: string; start?: number;
}) {
  if (!items.length) return null;
  return (
    <div className="section-gap" data-toc-root={items.length >= TOC_MIN ? "" : undefined}>
      {items.map((s, i) => (
        <section key={s.h2}>
          <Paragraphs items={s.paragraphs} head={<TocHeading id={`${idPrefix}${start + i + 1}`}>{s.h2}</TocHeading>} slots={slots} locale={locale} />
        </section>
      ))}
    </div>
  );
}
