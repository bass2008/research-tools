"use client";

import { useOptionalIndividualReading } from "@/components/account/IndividualReadingAccess";
import IndividualChakraFigure from "@/components/account/IndividualChakraFigure";
import IndividualReportView from "@/components/account/IndividualReportView";
import IndividualSaveBar from "@/components/account/IndividualSaveBar";
import { Paragraphs } from "@/components/enc/Sections";
import TocHeading from "@/components/enc/TocHeading";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import Octagram from "@/components/matrix/Octagram";
import PairOctagram from "@/components/pair/PairOctagram";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import { cardColumns } from "@/lib/cardColumns";
import { forLocale as matrixMapForLocale } from "@/lib/matrixMap";
import RichText from "@/components/ui/RichText";
import Link from "@/components/ui/LocalizedLink";
import { usePrintHref, usePrintSite } from "@/components/ui/PrintLinks";
import { useLocale } from "@/components/ui/LocaleProvider";
import type { Paragraph } from "@/lib/contentReader";
import type { IndividualReading, IndividualSection } from "@/lib/individualReading";

export default function IndividualArticleView({ row: given, printing = false, links = {} }: {
  row?: IndividualReading; printing?: boolean; links?: Record<string, string>;
} = {}) {
  const L = useLocale(), en = L === "en";
  const fromAccess = useOptionalIndividualReading();
  const printed = usePrintHref(), printSite = usePrintSite();
  const row = given ?? fromAccess;
  if (!row?.article) return null;
  if (row.article.version === 2) return <IndividualReportView row={row} report={row.article} printing={printing} links={links} />;
  const articleLocale = row.locale, articleEn = articleLocale === "en";
  const { arcanumTitle } = arcanaForLocale(articleLocale);
  const { mapPointsBySymbol } = matrixMapForLocale(articleLocale);
  const matrix = row.matrix;
  const pair = Boolean(matrix && "p" in matrix);
  // Карта называет точки буквами брифа; на личной схеме им соответствуют ключи сайта, центр — E.
  const pointKeys = (letters: string[] = []) => pair ? letters
    : letters.map((s) => s === "E" ? "center" : mapPointsBySymbol([s])[0]?.key).filter((k): k is string => Boolean(k));
  const body = (items: IndividualSection["paragraphs"]) => {
    const out: React.ReactNode[] = [];
    let run: Paragraph[] = [];
    const flush = (key: number) => { if (run.length) out.push(<Paragraphs key={`p${key}`} items={run} locale={articleLocale} />); run = []; };
    items.forEach((item, k) => {
      if (typeof item === "object" && "chakra" in item) {
        flush(k);
        if (matrix && !("p" in matrix)) out.push(<IndividualChakraFigure key={`c${k}`} m={matrix} chakra={item.chakra} locale={articleLocale} />);
      } else run.push(item);
    });
    flush(items.length);
    return out;
  };
  const cardHref = (n: number, keys: string[]) =>
    (pair ? undefined : keys.map((k) => links[`${k}/${n}`]).find(Boolean)) ?? `/encyclopedia/arcanum/${n}`;
  return <article className="panel individual-article" data-testid="individual-article" lang={row.locale} data-print-ready={printing ? "" : undefined}>
    <IndividualSaveBar row={row} />
    {row.status === "review" && !printing && <p className="hint">{en ? "Draft · awaiting review" : "Черновик · ожидает проверки"}</p>}
    <h1>{row.article.title}</h1>
    <div className="prose"><p><RichText text={row.article.lead} /></p></div>
    <div data-toc-root="">
      {row.matrix && <section className="individual-matrix">
        <TocHeading id="matrix">{articleEn ? "Your matrix at a glance" : "Ваша матрица: карта разбора"}</TocHeading>
        <figure className="individual-matrix-figure">
          {"p" in row.matrix
            ? <PairOctagram m={row.matrix.p} label={articleEn ? "Couple matrix" : "Матрица пары"} title={arcanumTitle} href={n => (printed ?? String)(`/encyclopedia/arcanum/${n}`)} />
            : <Octagram m={row.matrix} locale={articleLocale} printing={printing} site={printSite} />}
          <figcaption>{articleEn ? "The numbers come from your calculation. The cards below show the roles discussed in each section." : "Числа взяты из вашего расчёта. Карты ниже показывают роли, о которых идёт речь в каждом разделе."}</figcaption>
        </figure>
      </section>}
      {row.article.sections.map((section, i) => <section key={i} className="individual-article-section">
        <TocHeading id={`s${i + 1}`}>{section.h2}</TocHeading>
        {Boolean(section.cards?.length) && <ul className="poslist individual-article-cards" style={cardColumns(section.cards!.length)}
          data-cols={section.cards!.some((c) => c.points?.length) && section.cards!.length > 1 ? "2" : undefined}>
          {section.cards!.map((card, j) => {
            const keys = pointKeys(card.points);
            const mapped = Boolean(matrix && keys.length);
            return <li key={j} className={mapped ? "with-map" : undefined}>
              <Link className="poscard" href={cardHref(card.arcanum, keys)}>
                <span className="who">{card.label}</span>
                <ArcanumCard locale={articleLocale} n={card.arcanum} size="big" decorative eager={i === 0} />
                <span className="lb"><span className="nm"><span className="rn">{card.arcanum}</span> {arcanumTitle(card.arcanum)}</span></span>
              </Link>
              {mapped && <figure className="individual-card-map">
                {matrix && "p" in matrix
                  ? <PairOctagram m={matrix.p} label={articleEn ? "Couple matrix" : "Матрица пары"} title={arcanumTitle} focus={keys} />
                  : <Octagram m={matrix!} locale={articleLocale} linked={false} focus={keys} />}
              </figure>}
              <p className="postext"><RichText text={card.caption} /></p>
            </li>;
          })}
        </ul>}
        {body(section.paragraphs)}
        {Boolean(section.sources?.length) && <aside className="individual-sources" aria-label={articleEn ? "Sources for this section" : "Источники раздела"}>
          <p className="small">{articleEn ? "Sources and interpretation" : "Источники и интерпретация"}</p>
          <ul>{section.sources!.map((source, j) => <li key={j}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
            <p><RichText text={source.note} /></p>
          </li>)}</ul>
        </aside>}
      </section>)}
    </div>
  </article>;
}
