import type { ReactNode } from "react";
import Link from "@/components/ui/LocalizedLink";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n/lang";
import { ENERGY_FIELD_HREF, type ChakraReadingRow, type LongformReading } from "@/lib/readingTypes";
import { forLocale as localizedSite } from "@/lib/site";
import type { SiteProfile } from "@/lib/siteProfile";
import LockIcon from "@/components/ui/LockIcon";
import RichText from "@/components/ui/RichText";
import ArcanumCard from "./ArcanumCard";
import styles from "./ChakraReadingView.module.css";

function ChakraReadingCards({ cells, locale, href, printing, eager, locked }: {
  cells: ChakraReadingRow["cells"];
  locale: Lang;
  href: (path: string) => string;
  printing: boolean;
  eager: boolean;
  locked: boolean;
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
            <span className={locked ? `${styles.caption} ${styles.blurred}` : styles.caption}
              aria-hidden={locked || undefined}>{cell.caption}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export type UnlockLink = (className: string, label: ReactNode) => ReactNode;

export function ChakraReadingBlock({ row, number, locale, site, printing = false, eager = true, id, titleTag = "h2", titleHref, labelId, note, more, linkHref, unlock }: {
  row: ChakraReadingRow;
  number?: number;
  locale: Lang;
  site?: SiteProfile;
  printing?: boolean;
  eager?: boolean;
  id?: string;
  titleTag?: "h2" | "p";
  titleHref?: string;
  labelId: string;
  note?: ReactNode;
  more?: { href: string; label: string };
  /** Pages that already resolve print links (the couple reading) pass their own builder. */
  linkHref?: (path: string) => string;
  unlock?: UnlockLink;
}) {
  const { publicHref } = localizedSite(locale, site);
  const href = linkHref ?? ((path: string) => printing ? publicHref(path) : path);
  const Title = titleTag;
  const title = titleHref ? <Link href={href(titleHref)}>{row.title}</Link> : row.title;
  const labelled = titleTag === "h2";
  const locked = row.lockedWords !== undefined || row.lockedLabel !== undefined;
  const plate = locked ? <><LockIcon /> {row.lockedLabel ?? D.report.lockedWords[locale](row.lockedWords!)}</> : null;
  return (
    <section className={styles.block} id={id} data-chakra={row.key} aria-labelledby={labelId}>
      <div className={styles.side}>
        {number ? <span className={styles.number} aria-hidden="true">{String(number).padStart(2, "0")}</span> : null}
        <Title className={styles.title} id={labelled ? labelId : undefined}>{title}</Title>
        <p className={styles.topic}>{row.topic}</p>
        <div className={styles.numbers}>
          <strong>{row.cells.map((cell) => cell.arcanum).join(" / ")}</strong>
          <span>{row.cells.map((cell) => cell.title).join(" / ")}</span>
        </div>
        {note ? <p className={styles.share}>{note}</p> : null}
      </div>
      <div className={styles.main}>
        {row.heading ? <h3 className={locked ? `${styles.heading} ${styles.blurred}` : styles.heading}
          id={labelled ? undefined : labelId} aria-hidden={locked || undefined}>{row.heading}</h3> : null}
        <ChakraReadingCards cells={row.cells} locale={locale} href={href} printing={printing} eager={eager && !locked} locked={locked} />
        {locked ? <div className={styles.locked}>
          <p className={styles.lockPlate} data-testid={`chakra-lock-${row.key}`}>
            {unlock ? unlock(styles.pill, plate) : <span className={styles.pill}>{plate}</span>}
          </p>
          <div className={`${styles.copy} ${styles.blurred}`} aria-hidden="true">
            {row.paragraphs.map((paragraph, i) => (
              <p key={i} className={i === 2 ? styles.tension : undefined}>{paragraph}</p>
            ))}
          </div>
        </div> : <div className={styles.copy} data-empty={row.paragraphs.every((p) => !p) || undefined}>
          {row.paragraphs.map((paragraph, i) => (
            <p key={i} className={i === 2 ? styles.tension : undefined}><RichText text={paragraph} /></p>
          ))}
        </div>}
        {more ? <p className={styles.more}><Link href={href(more.href)} data-testid={`chakra-more-${row.key}`}>{more.label}</Link></p> : null}
      </div>
    </section>
  );
}

export default function ChakraReadingView({ reading, locale, site, printing = false, linkHref, unlock }: {
  reading: LongformReading;
  locale: Lang;
  site?: SiteProfile;
  printing?: boolean;
  linkHref?: (path: string) => string;
  unlock?: UnlockLink;
}) {
  return (
    <article className={styles.reading} data-testid={reading.testId}>
      {reading.lead ? <p className={styles.intro}>{reading.lead}</p> : null}
      {reading.chakraRows?.map((row, index) => (
        <ChakraReadingBlock key={row.key} row={row} number={index + 1} locale={locale} site={site} printing={printing} linkHref={linkHref} unlock={unlock}
          titleHref={`/encyclopedia/chakra/${row.key}`} labelId={`${reading.testId}-${row.key}`}
          more={{ href: `/encyclopedia/chakra/${row.key}`, label: D.sheet.chakraMore[locale](row.title) }} />
      ))}
      {reading.energyField ? (
        <ChakraReadingBlock row={reading.energyField} locale={locale} site={site} printing={printing} linkHref={linkHref} unlock={unlock}
          titleHref={ENERGY_FIELD_HREF} labelId={`${reading.testId}-energy-field`}
          more={{ href: ENERGY_FIELD_HREF, label: D.sheet.energyFieldMore[locale] }} />
      ) : null}
      {reading.chakraNote ? <p className={styles.note}>{reading.chakraNote}</p> : null}
    </article>
  );
}
