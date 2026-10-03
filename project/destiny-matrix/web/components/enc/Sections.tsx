import { Fragment, type ReactNode } from "react";
import { ChakraReadingBlock } from "@/components/matrix/ChakraReadingView";
import RichText from "@/components/ui/RichText";
import type { Paragraph, Section, Slot } from "@/lib/content";
import type { Lang } from "@/lib/i18n/lang";

export type Slots = Partial<Record<Slot, ReactNode>>;

function SectionItem({ item, slots }: { item: Exclude<Paragraph, { chakra_reading: unknown }>; slots?: Slots }) {
  if (typeof item === "string") return <p><RichText text={item} /></p>;
  if ("h3" in item) return <h3>{item.h3}</h3>;
  if ("ul" in item) return <ul>{item.ul.map((text, i) => <li key={i}><RichText text={text} /></li>)}</ul>;
  if ("ol" in item) return <ol>{item.ol.map((text, i) => <li key={i}><RichText text={text} /></li>)}</ol>;
  if ("slot" in item) return <>{slots?.[item.slot] ?? null}</>;
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
      prose.push(<SectionItem key={i} item={item} slots={slots} />);
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

export default function Sections({ items, slots, locale }: { items: Section[]; slots?: Slots; locale: Lang }) {
  if (!items.length) return null;
  return (
    <div className="section-gap">
      {items.map((s) => (
        <section key={s.h2}>
          <Paragraphs items={s.paragraphs} head={<h2>{s.h2}</h2>} slots={slots} locale={locale} />
        </section>
      ))}
    </div>
  );
}
