"use client";

import { useState, type ReactNode } from "react";
import IndividualChakraFigure from "@/components/account/IndividualChakraFigure";
import IndividualSaveBar from "@/components/account/IndividualSaveBar";
import { Paragraphs } from "@/components/enc/Sections";
import TocHeading from "@/components/enc/TocHeading";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import ChakraReadingView from "@/components/matrix/ChakraReadingView";
import { forLocale as localizedMatrixResult } from "@/components/matrix/MatrixResult";
import Octagram from "@/components/matrix/Octagram";
import PairOctagram from "@/components/pair/PairOctagram";
import Link from "@/components/ui/LocalizedLink";
import { usePrintHref, usePrintSite } from "@/components/ui/PrintLinks";
import RichText from "@/components/ui/RichText";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import { cardColumns } from "@/lib/cardColumns";
import type { Paragraph } from "@/lib/contentReader";
import type { Lang } from "@/lib/i18n/lang";
import {
  CHAPTER_LABEL, individualDates, individualKind, type ChapterKind, type Finding, type Formula, type FormulaItem,
  type IndividualCard, type IndividualReading, type IndividualReport, type ReportBlock, type SelfCheckItem,
  type TimelineItem,
} from "@/lib/individualReading";
import type { Matrix } from "@/lib/matrix";
import { forLocale as matrixMapForLocale } from "@/lib/matrixMap";
import type { PairResult } from "@/lib/pair/engine";
import type { SiteProfile } from "@/lib/siteProfile";

const PAIR_LABEL: Partial<Record<ChapterKind, [string, string]>> = {
  key: ["Ключ пары", "The key of the couple"],
  talents: ["Что каждый приносит в пару", "What each brings to the couple"],
  character: ["Пара глазами других и изнутри", "The couple seen from outside and within"],
  body: ["Что вас наполняет", "What fills you up"],
  money: ["Деньги пары", "The couple’s money"],
  relations: ["Отношения и общие цели", "Relationship and shared goals"],
  family: ["Пара как родители", "The couple as parents"],
  karma: ["Задачи пары", "The couple’s tasks"],
  close: ["Трудности и ссоры", "Difficulties and quarrels"],
  selfcheck: ["Самопроверка для двоих", "Self-check for two"],
  plan: ["План для двоих", "Plan for two"],
};
const OPERATOR: Record<string, [string, string]> = {
  "+": ["плюс", "plus"], "=": ["равно", "equals"], "↔": ["симметрично", "mirrors"], "→": ["переходит в", "leads to"],
};

type Ctx = {
  L: Lang; en: boolean; printing: boolean; printSite?: SiteProfile; matrix?: Matrix | PairResult; pair: boolean;
  arcanumTitle: (n: number) => string; pointKeys: (letters?: string[]) => string[];
  cardHref: (n: number, keys: string[]) => string; row: IndividualReading;
};

function MiniMap({ ctx, keys, className = "individual-card-map" }: { ctx: Ctx; keys: string[]; className?: string }) {
  const { matrix, en } = ctx;
  if (!matrix || !keys.length) return null;
  return <figure className={className}>
    {"p" in matrix
      ? <PairOctagram m={matrix.p} label={en ? "Couple matrix" : "Матрица пары"} title={ctx.arcanumTitle} focus={keys} />
      : <Octagram m={matrix} locale={ctx.L} linked={false} focus={keys} />}
  </figure>;
}

function Cards({ ctx, cards, eager }: { ctx: Ctx; cards: IndividualCard[]; eager: boolean }) {
  return <ul className="poslist individual-article-cards" style={cardColumns(cards.length)}
    data-cols={cards.some((c) => c.points?.length) && cards.length > 1 ? "2" : undefined}>
    {cards.map((card, j) => {
      const keys = ctx.pointKeys(card.points);
      const mapped = Boolean(ctx.matrix && keys.length);
      return <li key={j} className={mapped ? "with-map" : undefined}>
        <Link className="poscard" href={ctx.cardHref(card.arcanum, keys)}>
          <span className="who">{card.label}</span>
          <ArcanumCard locale={ctx.L} n={card.arcanum} size="big" decorative eager={eager} half={ctx.printing} />
          <span className="lb"><span className="nm"><span className="rn">{card.arcanum}</span> {ctx.arcanumTitle(card.arcanum)}</span></span>
        </Link>
        {mapped && <MiniMap ctx={ctx} keys={keys} />}
        <p className="postext"><RichText text={card.caption} /></p>
      </li>;
    })}
  </ul>;
}

// With a scheme next to it, a card in the formula shows its own point; clicking it again shows the whole formula.
function FormulaView({ ctx, formula }: { ctx: Ctx; formula: Formula }) {
  const [picked, setPicked] = useState<number | null>(null);
  const items = formula.items;
  const keys = ctx.pointKeys(items.flatMap((item) => typeof item === "string" ? [] : item.points ?? []));
  const interactive = Boolean(ctx.matrix && keys.length) && !ctx.printing;
  const chosen = picked === null ? undefined : items[picked];
  const own = chosen && typeof chosen !== "string" ? ctx.pointKeys(chosen.points) : [];
  const columns = items.map((item) => typeof item === "string" ? "auto" : "minmax(0, 132px)").join(" ");
  const face = (item: FormulaItem) => <>
    <span className="who">{item.label}</span>
    <ArcanumCard locale={ctx.L} n={item.arcanum} size="grid" decorative half={ctx.printing} />
    <span className="nm"><span className="rn">{item.arcanum}</span> {ctx.arcanumTitle(item.arcanum)}</span>
  </>;
  return <figure className="ir-formula" data-map={ctx.matrix && keys.length ? "" : undefined}>
    <div className="ir-formula-row" style={{ gridTemplateColumns: columns }}>
      {items.map((item, k) => typeof item === "string"
        ? <span key={k} className="ir-op" role="img" aria-label={OPERATOR[item]?.[ctx.en ? 1 : 0] ?? item}>{item}</span>
        : interactive
          ? <button key={k} type="button" className={picked === k ? "ir-fcard sel" : "ir-fcard"} aria-pressed={picked === k}
            onClick={() => setPicked(picked === k ? null : k)}>{face(item)}</button>
          : <Link key={k} className="ir-fcard" href={ctx.cardHref(item.arcanum, ctx.pointKeys(item.points))}>{face(item)}</Link>)}
    </div>
    <MiniMap ctx={ctx} keys={own.length ? own : keys} className="individual-card-map ir-formula-map" />
    {formula.caption && <figcaption><RichText text={formula.caption} /></figcaption>}
  </figure>;
}

function FindingView({ ctx, finding, number }: { ctx: Ctx; finding: Finding; number: number }) {
  return <article className="ir-finding">
    <h3><span className="ir-finding-num">{number}</span>{finding.title}</h3>
    {finding.formula && <FormulaView ctx={ctx} formula={finding.formula} />}
    <div className="prose">{finding.text.map((p, i) => <p key={i}><RichText text={p} /></p>)}</div>
    {finding.action && <p className="ir-finding-action"><strong>{ctx.en ? "What to do: " : "Что делать: "}</strong><RichText text={finding.action} /></p>}
  </article>;
}

function TimelineView({ ctx, items }: { ctx: Ctx; items: TimelineItem[] }) {
  return <ol className="ir-timeline">
    {items.map((item, i) => <li key={i} className={item.now ? "now" : undefined}>
      <span className="ir-age">{item.age}</span>
      <Link className="ir-tl-card" href={`/encyclopedia/arcanum/${item.arcanum}`}>
        <ArcanumCard locale={ctx.L} n={item.arcanum} size="mini" decorative half={ctx.printing} />
      </Link>
      <div className="ir-tl-text">
        <p className="ir-tl-arcanum"><span className="rn">{item.arcanum}</span> {ctx.arcanumTitle(item.arcanum)}
          {item.now && <span className="ir-now">{ctx.en ? "you are here" : "вы здесь"}</span>}</p>
        <p className="ir-tl-title">{item.title}</p>
        <p><RichText text={item.text} /></p>
      </div>
    </li>)}
  </ol>;
}

function SelfCheckView({ ctx, items }: { ctx: Ctx; items: SelfCheckItem[] }) {
  return <div className="ir-selfcheck">
    {items.map((item, i) => <article key={i} className="ir-sc">
      <header className="ir-sc-head">
        <Link className="ir-sc-card" href={ctx.cardHref(item.arcanum, ctx.pointKeys(item.points))}>
          <ArcanumCard locale={ctx.L} n={item.arcanum} size="mini" decorative half={ctx.printing} />
        </Link>
        <div><span className="who">{item.label}</span><strong><span className="rn">{item.arcanum}</span> {ctx.arcanumTitle(item.arcanum)}</strong></div>
        <MiniMap ctx={ctx} keys={ctx.pointKeys(item.points)} className="individual-card-map ir-sc-map" />
      </header>
      <div className="ir-sc-cols">
        <div className="ir-plus"><p>{ctx.en ? "In balance" : "В плюсе"}</p><ul>{item.plus.map((x, k) => <li key={k}><RichText text={x} /></li>)}</ul></div>
        <div className="ir-minus"><p>{ctx.en ? "Out of balance" : "В минусе"}</p><ul>{item.minus.map((x, k) => <li key={k}><RichText text={x} /></li>)}</ul></div>
      </div>
    </article>)}
  </div>;
}

function Insert({ ctx, name }: { ctx: Ctx; name: "chakras" | "karmic_tail" }) {
  const inserts = ctx.row.inserts ?? {};
  if (name === "chakras" && inserts.chakras) {
    return <div className="ir-insert" data-insert="chakras">
      <p className="ir-insert-label">{ctx.en ? "From your automatic reading · chakras" : "Из автоматического разбора · чакры"}</p>
      <ChakraReadingView reading={inserts.chakras} locale={ctx.L} printing={ctx.printing} site={ctx.printSite} />
    </div>;
  }
  if (name === "karmic_tail" && inserts.karmic_tail) {
    const tail = ctx.matrix && !("p" in ctx.matrix) ? ctx.matrix.karmic_tail?.join("-") : "";
    return <div className="ir-insert" data-insert="karmic_tail">
      <p className="ir-insert-label">{ctx.en ? "From your automatic reading · karmic tail" : "Из автоматического разбора · кармический хвост"}{tail ? ` ${tail}` : ""}</p>
      <div className="report-article"><Paragraphs items={inserts.karmic_tail.paragraphs} locale={ctx.L} /></div>
    </div>;
  }
  return null;
}

function Blocks({ ctx, blocks }: { ctx: Ctx; blocks: ReportBlock[] }) {
  const out: ReactNode[] = [];
  let run: Paragraph[] = [];
  let findings = 0;
  const flush = (key: number) => {
    if (run.length) out.push(<Paragraphs key={`p${key}`} items={run} locale={ctx.L} />);
    run = [];
  };
  blocks.forEach((block, k) => {
    if (typeof block !== "object" || "h3" in block || "ul" in block || "ol" in block || "table" in block) {
      run.push(block as Paragraph);
      return;
    }
    flush(k);
    if ("chakra" in block) {
      if (ctx.matrix && !("p" in ctx.matrix)) out.push(<IndividualChakraFigure key={k} m={ctx.matrix} chakra={block.chakra} locale={ctx.L} />);
    } else if ("formula" in block) out.push(<FormulaView key={k} ctx={ctx} formula={block.formula} />);
    else if ("finding" in block) out.push(<FindingView key={k} ctx={ctx} finding={block.finding} number={++findings} />);
    else if ("timeline" in block) out.push(<TimelineView key={k} ctx={ctx} items={block.timeline} />);
    else if ("selfcheck" in block) out.push(<SelfCheckView key={k} ctx={ctx} items={block.selfcheck} />);
    else if ("insert" in block) out.push(<Insert key={k} ctx={ctx} name={block.insert} />);
  });
  flush(blocks.length);
  return <>{out}</>;
}

export default function IndividualReportView({ row, report, printing = false, links = {} }: {
  row: IndividualReading; report: IndividualReport; printing?: boolean; links?: Record<string, string>;
}) {
  const L = row.locale, en = L === "en";
  const { arcanumTitle } = arcanaForLocale(L);
  const { mapPointsBySymbol } = matrixMapForLocale(L);
  const { birthLabel } = localizedMatrixResult(L);
  const matrix = row.matrix;
  const pair = Boolean(matrix && "p" in matrix);
  // Cards name points by brief letters; on the personal scheme they map to site keys, the centre is E.
  const pointKeys = (letters: string[] = []) => pair ? letters
    : letters.map((s) => s === "E" ? "center" : mapPointsBySymbol([s])[0]?.key).filter((k): k is string => Boolean(k));
  const cardHref = (n: number, keys: string[]) =>
    (pair ? undefined : keys.map((k) => links[`${k}/${n}`]).find(Boolean)) ?? `/encyclopedia/arcanum/${n}`;
  const printed = usePrintHref(), printSite = usePrintSite();
  const ctx: Ctx = { L, en, printing, printSite, matrix, pair, arcanumTitle, pointKeys, cardHref, row };
  const pad = (n: number) => String(n).padStart(2, "0");
  return <article className="ir" data-testid="individual-article" lang={L} data-print-ready={printing ? "" : undefined}>
    <IndividualSaveBar row={row} compact />
    {row.status === "review" && !printing && <p className="hint">{en ? "Draft · awaiting review" : "Черновик · ожидает проверки"}</p>}
    <header className="ir-hero panel">
      <div className="ir-hero-text">
        <p className="ir-kicker">{individualKind(row, L)} · {individualDates(row, birthLabel)}</p>
        <h1>{report.title}</h1>
        <p className="ir-lead"><RichText text={report.lead} /></p>
      </div>
      {matrix && <figure className="ir-hero-map">
        {"p" in matrix
          ? <PairOctagram m={matrix.p} label={en ? "Couple matrix" : "Матрица пары"} title={arcanumTitle} href={(n) => (printed ?? String)(`/encyclopedia/arcanum/${n}`)} />
          : <Octagram m={matrix} locale={L} printing={printing} site={printSite} />}
        <figcaption>{en ? "Your matrix. Next to the cards in each chapter, the same scheme highlights the points discussed."
          : "Ваша матрица. Рядом с картами в главах — та же схема с подсвеченными точками, о которых идёт речь."}</figcaption>
      </figure>}
    </header>
    <div data-toc-root="">
      <section className="ir-summary panel">
        <TocHeading id="summary">{en ? "The main points in a minute" : "Главное за минуту"}</TocHeading>
        <ol>{report.summary.map((item, i) => <li key={i}><RichText text={item} /></li>)}</ol>
      </section>
      {report.chapters.map((chapter, i) => <section key={i} className="ir-chapter panel" data-kind={chapter.kind}>
        <p className="ir-chapter-kicker"><span className="ir-num">{pad(i + 1)}</span>{(chapter.kind === "key" && row.year ? ["Ключ года", "The key of the year"]
          : (pair && PAIR_LABEL[chapter.kind]) || CHAPTER_LABEL[chapter.kind])?.[en ? 1 : 0]}</p>
        <TocHeading id={`c${i + 1}`}>{chapter.h2}</TocHeading>
        <p className="ir-conclusion"><RichText text={chapter.conclusion} /></p>
        {Boolean(chapter.cards?.length) && <Cards ctx={ctx} cards={chapter.cards!} eager={i === 0} />}
        <div className="ir-body"><Blocks ctx={ctx} blocks={chapter.blocks} /></div>
        {Boolean(chapter.actions?.length) && <aside className="ir-actions">
          <p className="ir-actions-title">{en ? "What to do with it" : "Что с этим делать"}</p>
          <ol>{chapter.actions!.map((action, k) => <li key={k}><RichText text={action} /></li>)}</ol>
        </aside>}
      </section>)}
      {Boolean(report.faq?.length) && <section className="ir-faq panel">
        <TocHeading id="faq">{en ? "Questions and answers" : "Вопросы и ответы"}</TocHeading>
        {report.faq!.map((q, i) => printing
          ? <div key={i} className="ir-q"><h3>{q.q}</h3><Paragraphs items={q.a} locale={L} /></div>
          : <details key={i} className="ir-q" open={i === 0}><summary>{q.q}</summary><Paragraphs items={q.a} locale={L} /></details>)}
      </section>}
      {Boolean(report.sources?.length) && <section className="ir-sources panel">
        <TocHeading id="sources">{en ? "Sources" : "Источники"}</TocHeading>
        <ul>{report.sources!.map((source, i) => <li key={i}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
          <p><RichText text={source.note} /></p>
        </li>)}</ul>
      </section>}
    </div>
  </article>;
}
