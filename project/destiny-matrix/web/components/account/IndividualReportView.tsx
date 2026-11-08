"use client";

import { useState, type ReactNode } from "react";
import IndividualChakraFigure from "@/components/account/IndividualChakraFigure";
import IndividualSaveBar from "@/components/account/IndividualSaveBar";
import { Paragraphs } from "@/components/enc/Sections";
import TocHeading from "@/components/enc/TocHeading";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import ChakraReadingView from "@/components/matrix/ChakraReadingView";
import { forLocale as localizedMatrixResult } from "@/components/matrix/MatrixResult";
import GoldScheme from "@/components/individual/landing/GoldScheme";
import Link from "@/components/ui/LocalizedLink";
import { usePrintHref, usePrintSite } from "@/components/ui/PrintLinks";
import RichText from "@/components/ui/RichText";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import { cardColumns } from "@/lib/cardColumns";
import type { Paragraph } from "@/lib/contentReader";
import type { Lang } from "@/lib/i18n/lang";
import {
  CHAPTER_LABEL, individualDates, individualKind, type ChapterKind, type Finding, type ForecastPoints, type Formula,
  type FormulaItem, type IndividualCard, type IndividualReading, type IndividualReport, type ReportBlock, type SelfCheckItem,
  type TimelineItem,
} from "@/lib/individualReading";
import { lettersOf } from "@/lib/individualLinks";
import type { Matrix } from "@/lib/matrix";
import { forLocale as matrixMapForLocale } from "@/lib/matrixMap";
import type { PairResult } from "@/lib/pair/engine";
import type { SiteProfile } from "@/lib/siteProfile";
import { monthPoints, yearPoints } from "@/lib/yearMatrix";

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
  // the year matrix and the month matrices of a year reading: they are not on the personal scheme
  forecast?: { year: number; birth: { y: number; m: number; d: number } };
  // numbers of the personal or the couple's scheme by the letters of the brief
  values?: Record<string, number>;
};

const MONTHS: [string[], string[]] = [
  ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
];

function forecastOf(row: IndividualReading) {
  const birth = typeof row.inputs?.birth === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(row.inputs.birth) : null;
  return row.year && birth ? { year: row.year, birth: { y: Number(birth[1]), m: Number(birth[2]), d: Number(birth[3]) } } : undefined;
}

// A card of the year or of a month shows its own matrix; a card that also stands on the personal scheme shows both.
function ForecastMap({ ctx, at, className = "individual-card-map" }: { ctx: Ctx; at: ForecastPoints; className?: string }) {
  const f = ctx.forecast;
  if (!f) return null;
  const month = at.month?.points?.length ? at.month : null;
  if (!month && !at.year?.length) return null;
  const values = month ? monthPoints(f.birth, f.year, month.n) : yearPoints(f.birth, f.year);
  const name = month ? (ctx.en ? `${MONTHS[1][month.n - 1]} ${f.year} matrix` : `Матрица ${MONTHS[0][month.n - 1]}`)
    : (ctx.en ? `${f.year} matrix` : `Матрица ${f.year} года`);
  return <figure className={`${className} ir-year-map`}>
    <GoldScheme kind={month ? "month" : "year"} values={values} locale={ctx.L} focus={month ? month.points : at.year ?? []} label={name} mini />
    <figcaption>{name}</figcaption>
  </figure>;
}

function Maps({ ctx, at, letters, className }: { ctx: Ctx; at: ForecastPoints; letters: string[]; className?: string }) {
  const year = ctx.forecast && (at.month?.points?.length || at.year?.length);
  if (!year) return <MiniMap ctx={ctx} letters={letters} className={className} />;
  if (!letters.length || !ctx.values) return <ForecastMap ctx={ctx} at={at} className={className} />;
  return <div className="ir-maps">
    <ForecastMap ctx={ctx} at={at} className={className} />
    <MiniMap ctx={ctx} letters={letters} className={`${className ?? "individual-card-map"} ir-own-map`}
      caption={ctx.en ? "Your matrix" : "Ваша матрица"} />
  </div>;
}

const hasForecast = (ctx: Ctx, at: ForecastPoints) => Boolean(ctx.forecast && (at.month?.points?.length || at.year?.length));

function MiniMap({ ctx, letters, className = "individual-card-map", caption }: { ctx: Ctx; letters: string[]; className?: string; caption?: string }) {
  const { values, en, pair } = ctx;
  const shown = letters.filter((k) => values?.[k] !== undefined);
  if (!values || !shown.length) return null;
  return <figure className={className}>
    <GoldScheme kind={pair ? "pair" : "personal"} values={values} locale={ctx.L} focus={shown} mini
      label={pair ? (en ? "Couple matrix" : "Матрица пары") : (en ? "Your matrix" : "Ваша матрица")} />
    {caption && <figcaption>{caption}</figcaption>}
  </figure>;
}

function Cards({ ctx, cards, eager }: { ctx: Ctx; cards: IndividualCard[]; eager: boolean }) {
  return <ul className="poslist individual-article-cards" style={cardColumns(cards.length)}
    data-cols={cards.some((c) => c.points?.length || hasForecast(ctx, c)) && cards.length > 1 ? "2" : undefined}>
    {cards.map((card, j) => {
      const keys = ctx.pointKeys(card.points);
      const mapped = Boolean(ctx.values && card.points?.length) || hasForecast(ctx, card);
      return <li key={j} className={mapped ? "with-map" : undefined}>
        <Link className="poscard" href={ctx.cardHref(card.arcanum, keys)}>
          <span className="who">{card.label}</span>
          <ArcanumCard locale={ctx.L} n={card.arcanum} size="big" decorative eager={eager} half={ctx.printing} />
          <span className="lb"><span className="nm"><span className="rn">{card.arcanum}</span> {ctx.arcanumTitle(card.arcanum)}</span></span>
        </Link>
        {mapped && <Maps ctx={ctx} at={card} letters={card.points ?? []} />}
        <p className="postext"><RichText text={card.caption} /></p>
      </li>;
    })}
  </ul>;
}

// With a scheme next to it, a card in the formula shows its own point; clicking it again shows the whole formula.
function FormulaView({ ctx, formula }: { ctx: Ctx; formula: Formula }) {
  const [picked, setPicked] = useState<number | null>(null);
  const items = formula.items;
  const cards = items.filter((item): item is FormulaItem => typeof item !== "string");
  const letters = cards.flatMap((item) => item.points ?? []);
  // all forecast points of the formula on one map: the year's, or one month's when the formula is about a month
  const month = cards.find((item) => item.month?.points?.length)?.month;
  const at: ForecastPoints = month
    ? { month: { n: month.n, points: cards.flatMap((item) => item.month?.n === month.n ? item.month.points : []) } }
    : { year: cards.flatMap((item) => item.year ?? []) };
  const mapped = Boolean(ctx.values && letters.length) || hasForecast(ctx, at);
  // "the year = yours": each card stands on its own scheme, so the scheme goes right under its card, card-wide
  const own1 = (item: FormulaItem) => Boolean(item.points?.length) && !hasForecast(ctx, item);
  const year1 = (item: FormulaItem) => hasForecast(ctx, item) && !item.points?.length;
  const paired = cards.length === 2 && items.length === 3 && Boolean(ctx.values)
    && ((year1(cards[0]) && own1(cards[1])) || (own1(cards[0]) && year1(cards[1])));
  const interactive = mapped && !ctx.printing && !paired;
  const chosen = picked === null ? undefined : items[picked];
  const own = chosen && typeof chosen !== "string" ? chosen : undefined;
  // the cards and the schemes under them share one grid: equal columns and a fixed gap for the sign, else a long label shifts a column
  const columns = paired ? "minmax(0, 1fr) 28px minmax(0, 1fr)"
    : items.map((item) => typeof item === "string" ? "auto" : "minmax(0, 132px)").join(" ");
  const face = (item: FormulaItem) => <>
    <span className="who">{item.label}</span>
    <ArcanumCard locale={ctx.L} n={item.arcanum} size={paired ? "big" : "grid"} decorative half={ctx.printing} />
    <span className="nm"><span className="rn">{item.arcanum}</span> {ctx.arcanumTitle(item.arcanum)}</span>
  </>;
  return <figure className="ir-formula" data-map={mapped ? "" : undefined}>
    <div className={paired ? "ir-formula-row ir-row-paired" : "ir-formula-row"} style={{ gridTemplateColumns: columns }}>
      {items.map((item, k) => typeof item === "string"
        ? <span key={k} className="ir-op" role="img" aria-label={OPERATOR[item]?.[ctx.en ? 1 : 0] ?? item}>{item}</span>
        : interactive
          ? <button key={k} type="button" className={picked === k ? "ir-fcard sel" : "ir-fcard"} aria-pressed={picked === k}
            onClick={() => setPicked(picked === k ? null : k)}>{face(item)}</button>
          : <Link key={k} className="ir-fcard" href={ctx.cardHref(item.arcanum, ctx.pointKeys(item.points))}>{face(item)}</Link>)}
    </div>
    {paired
      ? <div className="ir-maps ir-formula-row ir-maps-paired" style={{ gridTemplateColumns: columns }}>
        {items.map((item, k) => typeof item === "string" ? <span key={k} />
          : year1(item) ? <ForecastMap key={k} ctx={ctx} at={item} className="individual-card-map ir-formula-map" />
            : <MiniMap key={k} ctx={ctx} letters={item.points ?? []} className="individual-card-map ir-formula-map ir-own-map"
              caption={ctx.en ? "Your matrix" : "Ваша матрица"} />)}
      </div>
      : own
        ? <Maps ctx={ctx} at={own} letters={own.points ?? []} className="individual-card-map ir-formula-map" />
        : <Maps ctx={ctx} at={at} letters={letters} className="individual-card-map ir-formula-map" />}
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
        <div className="ir-sc-id">
          <span className="who">{item.label}</span>
          <Link className="ir-sc-card" href={ctx.cardHref(item.arcanum, ctx.pointKeys(item.points))}>
            <ArcanumCard locale={ctx.L} n={item.arcanum} size="grid" decorative half={ctx.printing} />
          </Link>
          <strong><span className="rn">{item.arcanum}</span> {ctx.arcanumTitle(item.arcanum)}</strong>
        </div>
        <Maps ctx={ctx} at={item} letters={item.points ?? []} className="individual-card-map ir-sc-map" />
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
  const forecast = pair ? undefined : forecastOf(row);
  const values: Record<string, number> | undefined = !matrix ? undefined : "p" in matrix
    ? matrix.p as unknown as Record<string, number> : lettersOf(matrix as Matrix);
  const ctx: Ctx = { L, en, printing, printSite, matrix, pair, arcanumTitle, pointKeys, cardHref, row, forecast, values };
  const arcanumHref = (n: number) => (printed ?? String)(`/encyclopedia/arcanum/${n}`);
  const pad = (n: number) => String(n).padStart(2, "0");
  const personalFigure = values ? <figure className="ir-hero-map">
    <GoldScheme kind={pair ? "pair" : "personal"} values={values} locale={L} all href={arcanumHref}
      label={pair ? (en ? "Couple matrix" : "Матрица пары") : (en ? "Your matrix" : "Ваша матрица")} />
    <figcaption>{forecast
      ? (en ? "Your personal matrix. Next to the cards, the scheme the card stands on highlights its points: the year, a month or yours."
        : "Ваша личная матрица. Рядом с картами в главах — схема, на которой стоит карта: года, месяца или ваша, с подсвеченными точками.")
      : en ? "Your matrix. Next to the cards in each chapter, the same scheme highlights the points discussed."
        : "Ваша матрица. Рядом с картами в главах — та же схема с подсвеченными точками, о которых идёт речь."}</figcaption>
  </figure> : null;
  const yearFigure = forecast ? <figure className="ir-hero-map ir-hero-year" data-testid="year-matrix">
    <GoldScheme kind="year" values={yearPoints(forecast.birth, forecast.year)} locale={L} all href={arcanumHref}
      label={en ? `Matrix of ${forecast.year}` : `Матрица ${forecast.year} года`} />
    <figcaption>{en
      ? `The ${forecast.year} matrix by Lisovskaya’s “Prognostics”: the centre is the background of the year; the top and the upper left corner are the plus; the right and the bottom the minus; the left — people; the upper right — the weak spot; the lower corners — what the year is good for. Inside — the three thirds of the year; lines join one card standing on several points.`
      : `Матрица ${forecast.year} года по «Прогностике» Лисовской: центр — фон года; сверху и в левом верхнем углу — плюс, справа и снизу — минус; слева — люди; правый верхний угол — слабое место; нижние углы — для чего хорош год. Внутри — три трети года; линии соединяют точки, где стоит одна карта.`}</figcaption>
  </figure> : null;
  return <article className="ir" data-testid="individual-article" lang={L} data-print-ready={printing ? "" : undefined}>
    <IndividualSaveBar row={row} compact />
    {row.status === "review" && !printing && <p className="hint">{en ? "Draft · awaiting review" : "Черновик · ожидает проверки"}</p>}
    <header className="ir-hero panel">
      <div className="ir-hero-text">
        <p className="ir-kicker">{individualKind(row, L)} · {individualDates(row, birthLabel)}</p>
        <h1>{report.title}</h1>
        <p className="ir-lead"><RichText text={report.lead} /></p>
      </div>
      {yearFigure && personalFigure ? <div className="ir-hero-maps">{yearFigure}{personalFigure}</div> : personalFigure}
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
