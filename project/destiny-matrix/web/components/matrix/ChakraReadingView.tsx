import type { ReactNode } from "react";
import Link from "next/link";
import { forLocale as localizedArcana } from "@/lib/arcana";
import type { Lang } from "@/lib/i18n/lang";
import type { ChakraReadingRow, LongformReading } from "@/lib/readingTypes";
import { forLocale as localizedSite } from "@/lib/site";
import type { SiteProfile } from "@/lib/siteProfile";
import ArcanumCard from "./ArcanumCard";
import styles from "./ChakraReadingView.module.css";

/** Единственная поддержанная разметка в корпусе — выделение мысли; HTML не исполняется. */
function Copy({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**")
    ? <strong key={i}>{part.slice(2, -2)}</strong>
    : part);
}

function ChakraReadingCards({ cells, locale, href, printing, eager }: {
  cells: ChakraReadingRow["cells"];
  locale: Lang;
  href: (path: string) => string;
  printing: boolean;
  eager: boolean;
}) {
  const { arcanumTitle } = localizedArcana(locale);
  return (
    <div className={styles.cards}>
      {cells.map((cell) => (
        <figure key={cell.column} data-column={cell.column} data-arcanum={cell.arcanum}>
          <Link className={styles.image} href={href(`/encyclopedia/arcanum/${cell.arcanum}`)}>
            <ArcanumCard locale={locale} n={cell.arcanum} size="big" half={printing} eager={eager} />
          </Link>
          <figcaption>
            <span className={styles.role}>{cell.title}</span>
            <strong>{cell.arcanum} · {arcanumTitle(cell.arcanum)}</strong>
            <span className={styles.caption}>{cell.caption}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function ChakraReadingBlock({ row, number, locale, site, printing = false, eager = true, id, titleTag = "h2", titleHref, labelId, note }: {
  row: ChakraReadingRow;
  number: number;
  locale: Lang;
  site?: SiteProfile;
  printing?: boolean;
  eager?: boolean;
  id?: string;
  titleTag?: "h2" | "p";
  titleHref?: string;
  labelId: string;
  note?: ReactNode;
}) {
  const { publicHref } = localizedSite(locale, site);
  const href = (path: string) => printing ? publicHref(path) : path;
  const Title = titleTag;
  const title = titleHref ? <Link href={href(titleHref)}>{row.title}</Link> : row.title;
  const labelled = titleTag === "h2";
  return (
    <section className={styles.block} id={id} data-chakra={row.key} aria-labelledby={labelId}>
      <div className={styles.side}>
        <span className={styles.number} aria-hidden="true">{String(number).padStart(2, "0")}</span>
        <Title className={styles.title} id={labelled ? labelId : undefined}>{title}</Title>
        <p className={styles.topic}>{row.topic}</p>
        <div className={styles.numbers}>
          <strong>{row.cells.map((cell) => cell.arcanum).join(" / ")}</strong>
          <span>{row.cells.map((cell) => cell.title).join(" / ")}</span>
        </div>
        {note ? <p className={styles.share}>{note}</p> : null}
      </div>
      <div className={styles.main}>
        {row.heading ? <h3 className={styles.heading} id={labelled ? undefined : labelId}>{row.heading}</h3> : null}
        <ChakraReadingCards cells={row.cells} locale={locale} href={href} printing={printing} eager={eager} />
        <div className={styles.copy} data-empty={row.paragraphs.every((p) => !p) || undefined}>
          {row.paragraphs.map((paragraph, i) => (
            <p key={i} className={i === 2 ? styles.tension : undefined}><Copy text={paragraph} /></p>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ChakraReadingView({ reading, locale, site, printing = false }: {
  reading: LongformReading;
  locale: Lang;
  site: SiteProfile;
  printing?: boolean;
}) {
  return (
    <article className={styles.reading} data-testid={reading.testId}>
      {reading.lead ? <p className={styles.intro}>{reading.lead}</p> : null}
      {reading.chakraRows?.map((row, index) => (
        <ChakraReadingBlock key={row.key} row={row} number={index + 1} locale={locale} site={site} printing={printing}
          titleHref={`/encyclopedia/chakra/${row.key}`} labelId={`${reading.testId}-${row.key}`} />
      ))}
      {reading.chakraNote ? <p className={styles.note}>{reading.chakraNote}</p> : null}
    </article>
  );
}
