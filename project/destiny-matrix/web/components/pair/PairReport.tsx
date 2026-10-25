import LockIcon from "@/components/ui/LockIcon";
import BuyLink from "@/components/pay/BuyLink";
import RichText from "@/components/ui/RichText";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { DP } from "@/lib/i18n/dict/pair";
import type { Lang as Locale } from "@/lib/i18n/lang";
import { forLocale as localizedMatrix } from "@/lib/matrix";
import { BUSINESS_FREE, BUSINESS_SPHERES, businessDate, businessMatrix, businessPoints, businessUnitKey, type BusinessPoint } from "@/lib/pair/business";
import type { PairResult, PointKey } from "@/lib/pair/engine";
import {
  amplified, blocks, distinctCards, FREE, MAIN, SUMMARY, sphereOf, unitKeys, visible,
  type Block, type PairUnit, type RoleId, type Sphere, type SphereId,
} from "@/lib/pair/spheres";
import Link from "next/link";
import type { ReactNode } from "react";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import ChakraReadingView from "@/components/matrix/ChakraReadingView";
import { LockedBody, LockedCards, type LockedCard } from "@/components/matrix/LockedSection";
import { D } from "@/lib/i18n";
import { lockedPairChakraReading, pairChakraMap, pairChakraReading } from "@/lib/pair/chakraReading";
import { PERSONAL_TAILS } from "@/lib/pair/personalTails";
import PairChakras from "./PairChakras";
import PairOctagram from "./PairOctagram";
import styles from "./Pair.module.css";

const SPHERE_ARTICLE = { tasks: "/karmic-compatibility", atmosphere: "/compatibility-center", characters: "/encyclopedia/compatibility" } as const;
const hasArticle = (id: SphereId): id is keyof typeof SPHERE_ARTICLE => id in SPHERE_ARTICLE;

export interface PairReportProps {
  locale: Locale;
  result: PairResult;
  /** название пары — `pairTitle`: одно на все экраны */
  title: string;
  names: { a: string; b: string };
  dates: { a: string; b: string };
  units: Record<string, PairUnit | null>;
  mode: "full" | "free";
  printing?: boolean;
  example?: boolean;
  /** кнопка PDF справа в шапке разбора — как на основном сайте */
  pdf?: ReactNode;
  /** куда ведёт покупка в бесплатном режиме */
  buyHref?: string;
  price?: string | null;
  /** адрес ссылки в PDF: печать открывается на внутреннем хосте, ссылки должны вести на сайт */
  publicHref?: (path: string) => string;
  /** на странице калькулятора заголовок страницы свой, и шапка разбора идёт вторым уровнем */
  heading?: "h1" | "h2";
  /** разбор уже открыт человеку (куплен или подписка): вместо покупки — переход к нему */
  open?: ReactNode;
  /** тарифы под разбором — как на главной: эта пара или подписка */
  plans?: ReactNode;
}

function paragraphs(unit: PairUnit | null | undefined): string[] {
  if (!unit?.text) return [];
  return Array.isArray(unit.text) ? unit.text : [unit.text];
}

export default function PairReport(props: PairReportProps) {
  const { locale: L, result, names, dates, units, mode, printing = false, example = false } = props;
  const { a, b, p } = result;
  const { arcanumTitle } = localizedArcana(L);
  const { birthLabel } = localizedMatrix(L);
  // Модуль энциклопедии сюда не импортируется: он тянет в клиентский чанк каталог позиций с
  // толкованиями платных разделов (сторож — scripts/check-build.cjs).
  const href = (path: string) => (printing && props.publicHref ? props.publicHref(path) : path);
  // У энергий, которые бывают в матрице пары (2–22), своя страница «N в совместимости»: ссылка из
  // сферы ведёт туда, а не на общую статью аркана.
  const compatibilityHref = (n: number) => (n >= 2 && n <= 22 ? `/encyclopedia/compatibility/${n}` : `/encyclopedia/arcanum/${n}`);

  // Каждая карта пары ведёт к своему аркану, как карты личного разбора: числа пары — на страницу
  // «N в совместимости», деловые точки и карты партнёров — на общую статью аркана.
  const arcanumPage = (n: number, compat = true) => href(compat ? compatibilityHref(n) : `/encyclopedia/arcanum/${n}`);
  const picture = (n: number, compat = true, half = printing) => (
    <Link href={arcanumPage(n, compat)} className={styles.acLink} data-arcanum={n} tabIndex={-1} aria-hidden="true">
      <ArcanumCard locale={L} n={n} size="big" decorative half={half} eager={printing} />
    </Link>
  );
  const named = (n: number, compat = true) => (
    <Link href={arcanumPage(n, compat)} className={styles.acName}>{bub(n)} {arcanumTitle(n)}</Link>
  );
  const keyCard = (n: number) => (
    <Link href={arcanumPage(n)} className={styles.keyCard} aria-label={arcanumTitle(n)} data-arcanum={n}>
      <ArcanumCard locale={L} n={n} size="mini" decorative half={printing} />
    </Link>
  );
  // Подробные чакры пары открыты вместе с полным разбором, как раздел «Чакры» в личном разборе.
  const chakraReading = mode === "full" ? pairChakraReading(L, dates, units) : undefined;
  const chakraTotals = pairChakraMap(L, dates).totals;
  const chakraNums = `Σ ${chakraTotals.physics}-${chakraTotals.energy}-${chakraTotals.emotions}`;
  const all = visible(a, b);
  const isOpen = (id: SphereId) => mode === "full" || FREE.includes(id);
  const opened = all.filter((s) => isOpen(s.id));
  const locked = all.filter((s) => !isOpen(s.id));
  const couple = props.title;

  const role = (id: RoleId) => DP.role[id][L];
  const pointTitle = (n: number) => `${n} · ${arcanumTitle(n)}`;
  const title = (id: SphereId) => DP.sphere[id].title[L];
  const firstUnit = (s: Sphere): PairUnit | null => {
    for (const key of unitKeys(s, a, b, p)) if (units[key]) return units[key];
    return null;
  };
  const meaning = (s: Sphere) => firstUnit(s)?.meaning ?? null;
  const cardsOf = (s: Sphere): number[] =>
    [...new Set(s.kind === "cards" ? s.cards!.map(([k]) => p[k]) : blocks(s, a, b, p).map((x) => x.card))];
  const nums = (s: Sphere) => s.nums ? s.nums(p) : blocks(s, a, b, p).map((x) => x.card).join(", ");

  const bub = (n: number) => <span className={styles.bub}>{n}</span>;

  const card = (n: number, roleId: RoleId, caption?: string | null) => (
    <figure className={styles.ac} key={`${roleId}-${n}`}>
      <span className={styles.acRole}>{role(roleId)}</span>
      {picture(n)}
      <figcaption>{named(n)}</figcaption>
      {caption ? <span className={styles.acCap}>{caption}</span> : null}
    </figure>
  );

  // Закрытая сфера — как закрытый раздел личного разбора: лид, карты её позиций и кнопка покупки.
  const buying = Boolean(props.buyHref && !props.open);
  const lockedBlock = (id: string, name: string, lead: ReactNode, body: ReactNode) => (
    <div className="acc lock" key={id} data-testid={`pair-lock-${id}`} data-locked="true">
      {buying ? (
        <BuyLink className="head" href={props.buyHref!} analytics={{ tariff: "pair", place: "pair-section", section: id }}>{name}<span className="unlock"><LockIcon /> {DP.unlock[L]}</span></BuyLink>
      ) : (
        // замок виден всегда: у примера и у подписчика купить нечего, и без значка закрытые сферы
        // выглядели бы обычными
        <span className="head">{name}<span className="unlock"><LockIcon /> {DP.inFull[L]}</span></span>
      )}
      {printing ? null : (
        <LockedBody testId={`pair-preview-${id}`} lead={lead} cta={buying ? (
          <BuyLink className="btn gold" href={props.buyHref!} data-testid={`pair-buy-${id}`} analytics={{ tariff: "pair", place: "pair-section", section: id }}>
            <span>{props.price ? `${D.report.unlockSection[L]}${props.price}` : DP.unlock[L]}</span>
          </BuyLink>
        ) : null}>
          {body}
        </LockedBody>
      )}
    </div>
  );
  // У хвоста каждая точка — самостоятельная задача, даже если аркан повторяется.
  const sectionCards = (s: Sphere) => s.id === "tasks" ? (s.cards ?? []) : distinctCards(s, p);
  const sphereCards = (s: Sphere): LockedCard[] => s.kind === "cards"
    ? sectionCards(s).map(([k, r]) => ({ n: p[k], who: role(r), href: arcanumPage(p[k]) }))
    : blocks(s, a, b, p).map((x) => ({ n: x.card, who: role(x.role), href: arcanumPage(x.card) }));

  const body = (unit: PairUnit | null | undefined) => {
    const text = paragraphs(unit);
    if (!text.length) return <p className={styles.stub}>{DP.stub[L]}</p>;
    return text.map((t, i) => <p key={i}><RichText text={t} /></p>);
  };

  // Ссылка на каждый аркан сферы: у сферы бывает две-три карты, и все они ведут к своему разбору.
  const encLinks = (cards: number[]) => (
    <p className="encref">
      {cards.map((n, i) => <span key={n}>{i ? " · " : null}
        <Link href={href(compatibilityHref(n))}>{DP.inCompatibility[L](arcanumTitle(n))}</Link></span>)}
    </p>
  );
  const tail = `${p.M}-${p.N}-${p.D}`;

  const prefix = (x: Block) => {
    if (!x.lead) return null;
    const name = arcanumTitle(x.lead.card);
    const text = x.lead.kind === "both" ? DP.characterBoth[L](name)
      : x.lead.kind === "one" ? DP.characterOne[L](name) : DP.wishesOne[L](name);
    return <p className={styles.prefix}>{text}</p>;
  };

  const section = (s: Sphere, i: number) => {
    let inner: ReactNode;
    if (s.kind === "cards") {
      const unit = units[s.key!(p)] ?? null;
      const shown = sectionCards(s);
      const width = s.cards!.length === 1 ? 1 : shown.length;
      inner = (
        <>
          {unit?.title ? <h3 className={styles.secTitle}>{unit.title}</h3> : null}
          <div className={`${styles.read} ${styles[`read${width}`] ?? ""}`}>
            <div className={styles.acs}>{shown.map(([k, r]) => card(p[k], r, unit?.captions?.[k]))}</div>
            <div className={styles.txt}>
              {body(unit)}
              {amplified(s, p).map((n) => <p className={styles.amp} key={n}>{DP.amplified[L](arcanumTitle(n),
                (["H", "I"] as const).filter((point) => p[point] === n)
                  .map((point) => DP.amplifierPoint[point][L]).join("; "))}</p>)}
            </div>
          </div>
        </>
      );
    } else {
      inner = (
        <div className={styles.blocks}>
          {blocks(s, a, b, p).map((x) => {
            const unit = units[x.unit] ?? null;
            const capKey = x.unit.split(":")[1];
            return (
              <div className={styles.ublock} key={x.unit}>
                {card(x.card, x.role, unit?.captions?.[capKey])}
                <div className={styles.txt}>{prefix(x)}{body(unit)}</div>
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <details className={styles.sec} open key={s.id} id={`sec-${s.id}`} data-sec={s.id}>
        <summary>
          <span className={styles.secN}>{i + 1}</span>{title(s.id)}
          <span className={`${styles.secNums} ${styles.mono}`}>{nums(s)}</span>
        </summary>
        <p className={styles.lead}>{DP.sphere[s.id].lead[L]}</p>
        {inner}
        {encLinks(cardsOf(s))}
        {s.id === "tasks" && PERSONAL_TAILS.has(tail) ? (
          <p className="encref"><Link href={href(`/encyclopedia/karmic-tail/${tail}`)} data-testid="pair-tail-personal">
            {DP.tailPersonal[L](tail)}</Link></p>
        ) : null}
        {hasArticle(s.id) ? (
          <p className="encref"><Link href={href(SPHERE_ARTICLE[s.id])} data-testid={`pair-article-${s.id}`}>
            {DP.article[s.id][L]}</Link></p>
        ) : null}
      </details>
    );
  };

  const summaryRows = SUMMARY.map((id) => all.find((s) => s.id === id)).filter((s): s is Sphere => Boolean(s))
    .map((s) => ({ s, text: meaning(s) }))
    .filter(({ s, text }) => text || !isOpen(s.id));

  // Совместимость в работе: своя матрица из сложения дат, сферы по таблице автора (глава 5).
  const biz = businessPoints(businessMatrix(dates.a, dates.b, L));
  const bizDate = businessDate(dates.a, dates.b);
  const bizOpen = (id: string) => mode === "full" || (BUSINESS_FREE as readonly string[]).includes(id);
  const bizNums = (points: BusinessPoint[]) => points.map((x) => biz[x]).join(points.length === 3 ? "-" : ", ");
  const bizLocked = BUSINESS_SPHERES.filter((s) => !bizOpen(s.id));
  const bizSection = (
    <div className={styles.biz} id="pair-business" data-testid="pair-business">
      <div className={styles.readingHead}>
        <h2>{DP.business.title[L]}</h2>
        <span className={styles.dim}>{DP.business.count[L](BUSINESS_SPHERES.length - bizLocked.length, BUSINESS_SPHERES.length)}</span>
      </div>
      <p className={styles.lead}>{DP.business.lead[L]} <span className={styles.mono}>{DP.business.date[L](bizDate.day, bizDate.month, bizDate.year)}</span></p>
      {BUSINESS_SPHERES.filter((s) => bizOpen(s.id)).map((s) => {
        const seen = new Set<string>();
        const points = s.points.filter((x) => {
          const key = businessUnitKey(x, biz[x]);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return (
          <details className={styles.sec} open key={s.id} data-sec={`business-${s.id}`}>
            <summary>{DP.business.sphere[s.id].title[L]}<span className={`${styles.secNums} ${styles.mono}`}>{bizNums(s.points)}</span></summary>
            <p className={styles.lead}>{DP.business.sphere[s.id].lead[L]}</p>
            <div className={styles.blocks}>
              {points.map((x) => {
                const n = biz[x];
                const unit = units[businessUnitKey(x, n)] ?? null;
                const family = businessUnitKey(x, n).split(":")[1];
                return (
                  <div className={styles.ublock} key={x}>
                    <figure className={styles.ac}>
                      <span className={styles.acRole}>{DP.business.point[x][L]}</span>
                      {picture(n, false)}
                      <figcaption>{named(n, false)}</figcaption>
                      {unit?.captions?.[family] ? <span className={styles.acCap}>{unit.captions[family]}</span> : null}
                    </figure>
                    <div className={styles.txt}>{body(unit)}</div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
      <p className="encref"><Link href={href("/business-compatibility")} data-testid="pair-article-business">
        {DP.article.business[L]}</Link></p>
      {bizLocked.length ? (
        <div className={styles.locks} data-testid="pair-business-locks">
          {bizLocked.map((s) => {
            const seen = new Set<string>();
            const cards = s.points.filter((x) => {
              const key = businessUnitKey(x, biz[x]);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            }).map((x) => ({ n: biz[x], who: DP.business.point[x][L], href: arcanumPage(biz[x], false) }));
            return lockedBlock(`business-${s.id}`, DP.business.sphere[s.id].title[L], DP.business.sphere[s.id].lead[L],
              <LockedCards locale={L} cards={cards} />);
          })}
        </div>
      ) : null}
    </div>
  );

  const mainCaption = (key: PointKey, sphere: SphereId) => units[sphereOf(sphere).key!(p)]?.captions?.[key] ?? "";
  const mergeRow = (k: "E" | "A" | "B" | "D" | "N" | "M") => {
    const raw = a[k] + b[k];
    return (
      <tr key={k}>
        <td>{DP.merge[k][L]}</td>
        <td className={styles.mono}>{`${a[k]} + ${b[k]} = ${raw}${raw > 22 ? ` → ${p[k]}` : ""}`}</td>
        <td><Link href={arcanumPage(p[k])} className={styles.bubLink} aria-label={arcanumTitle(p[k])}>{bub(p[k])}</Link></td>
      </tr>
    );
  };

  return (
    <div className={styles.page} data-testid="pair-report" data-mode={mode} data-print-ready={printing ? "" : undefined}>
      <div className={styles.head}>
        {(props.heading ?? "h1") === "h1"
          ? <h1>{example ? DP.example[L] : couple}</h1>
          : <h2>{example ? DP.example[L] : couple}</h2>}
        <div className={styles.rsub}>
          <p className={styles.dim}>
            {DP.subFull[L](`${birthLabel(dates.a)} + ${birthLabel(dates.b)}`, opened.length, all.length)}
          </p>
          {props.pdf ? <span className={styles.pdfslot}>{props.pdf}</span> : null}
        </div>
      </div>

      <section className={`${styles.card} ${styles.block}`} id="pair-merge">
        <div className={styles.blockHead}>
          <div className={styles.headMain}>
            <h2>{DP.mergeTitle[L]}</h2>
            {example ? <span className={styles.badge}>{DP.example[L]}</span> : null}
          </div>
          <p className={styles.dim}>{DP.mergeLead[L]}</p>
        </div>
        <div className={styles.merge}>
          <div className={styles.mergeMaps}>
            <figure><figcaption>{names.a}<span>{birthLabel(dates.a)}</span></figcaption>
              <PairOctagram m={a} label={names.a} title={pointTitle} href={(n) => arcanumPage(n, false)} /></figure>
            <span className={styles.op}>+</span>
            <figure><figcaption>{names.b}<span>{birthLabel(dates.b)}</span></figcaption>
              <PairOctagram m={b} label={names.b} title={pointTitle} href={(n) => arcanumPage(n, false)} /></figure>
            <span className={`${styles.op} ${styles.opEq}`}>=</span>
            <figure className={styles.mergeSum}>
              <figcaption>{DP.mapTitle[L]}<span>{`${names.a} + ${names.b}`}</span></figcaption>
              <PairOctagram m={p} label={DP.mapTitle[L]} title={pointTitle} href={(n) => arcanumPage(n)} />
            </figure>
          </div>
          <table className={styles.eq}>
            <thead><tr><th>{DP.colPoint[L]}</th><th>{`${names.a} + ${names.b}`}</th><th>{DP.colCouple[L]}</th></tr></thead>
            <tbody>
              {(["E", "A", "B", "D", "N", "M"] as const).map(mergeRow)}
              <tr>
                <td>{DP.role.values[L]}</td>
                <td className={styles.mono}>{`${DP.merged[L]}: ${p.personal} + ${p.social}`}</td>
                <td><Link href={arcanumPage(p.spiritual)} className={styles.bubLink} aria-label={arcanumTitle(p.spiritual)}>{bub(p.spiritual)}</Link></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <PairChakras locale={L} dates={dates} printing={printing} locked={mode !== "full"} reading={chakraReading}
        cta={props.open ?? (props.buyHref
          ? <BuyLink className={`${styles.btn} ${styles.btnGold}`} href={props.buyHref} analytics={{ tariff: "pair", place: "pair-main" }}>{props.price ? DP.buy[L](props.price) : DP.buyNoPrice[L]}</BuyLink>
          : <span className={styles.dim}>{DP.inFull[L]}</span>)} />

      <section className={`${styles.card} ${styles.keys}`}>
        <h2>{DP.keysTitle[L]}</h2>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileL}>{DP.role.atmosphere[L]}</span>
            <span className={styles.tileRow}><span className={styles.tileCards}>{keyCard(p.E)}</span><span className={styles.tileV}>{p.E}</span></span>
            <span className={styles.tileS}>{arcanumTitle(p.E)}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileL}>{DP.sphere.meet.title[L]}</span>
            <span className={styles.tileRow}><span className={`${styles.tileCards} ${styles.tilePair}`}>{keyCard(p.A)}{keyCard(p.B)}</span><span className={styles.tileV}>{`${p.A} + ${p.B}`}</span></span>
            <span className={styles.tileS}>{`${arcanumTitle(p.A)}, ${arcanumTitle(p.B)}`}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileL}>{DP.sphere.tasks.title[L]}</span>
            <span className={styles.tileChain}>
              {[p.M, p.N, p.D].map((n, i) => <span key={i} className={styles.tileLink}>{i ? <i aria-hidden="true">→</i> : null}<span className={styles.tileStep}>{keyCard(n)}<b>{n}</b></span></span>)}
            </span>
            <span className={styles.tileS}>{[p.M, p.N, p.D].map(arcanumTitle).join(", ")}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileL}>{DP.role.values[L]}</span>
            <span className={styles.tileRow}><span className={styles.tileCards}>{keyCard(p.spiritual)}</span><span className={styles.tileV}>{p.spiritual}</span></span>
            <span className={styles.tileS}>{arcanumTitle(p.spiritual)}</span>
          </div>
        </div>
      </section>

      {summaryRows.length ? (
        <section className={`${styles.card} ${styles.summary}`} data-testid="pair-summary">
          <h2>{DP.summaryTitle[L]}</h2>
          <ul className={styles.sum}>
            {summaryRows.map(({ s, text }) => (
              <li key={s.id} className={isOpen(s.id) ? undefined : styles.locked}>
                <span className={styles.sumH}>
                  <span className={styles.sumL}>{DP.summary[s.id as keyof typeof DP.summary][L]}</span>
                  <span className={styles.sumAs}>
                    {cardsOf(s).map((n) => <Link href={arcanumPage(n)} className={styles.sumA} key={n}>{bub(n)}{arcanumTitle(n)}</Link>)}
                  </span>
                </span>
                {isOpen(s.id)
                  ? <span className={styles.sumT}>{text}</span>
                  : <span className={styles.sumT}><LockIcon />{DP.inFull[L]}</span>}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={`${styles.card} ${styles.block}`} id="pair-main">
        <div className={styles.blockHead}><h2>{DP.mainTitle[L]}</h2><p className={styles.dim}>{DP.mainLead[L]}</p></div>
        <div className={styles.mainCards} data-testid="pair-main-cards">
          {MAIN.map((m) => {
            const n = p[m.key];
            return (
              <figure className={styles.mc} key={m.role}>
                <span className={styles.mcL}>{role(m.role)}</span>
                {picture(n, true, true)}
                <figcaption>
                  <Link href={arcanumPage(n)} className={styles.mcN}>{bub(n)}<b>{arcanumTitle(n)}</b></Link>
                  <span className={styles.mcCap}>{mainCaption(m.key, m.sphere)}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      <details className={`${styles.card} ${styles.block} ${styles.all}`} open={printing} id="pair-all">
        <summary><h2>{DP.allTitle[L]}</h2><span className={styles.dim}>{DP.allLead[L]}</span></summary>
        <div className={styles.tableWrap}>
          <table className={styles.allT}>
            <thead><tr><th>{DP.colSphere[L]}</th><th>{DP.colNumbers[L]}</th><th>{DP.colMeaning[L]}</th></tr></thead>
            <tbody>
              {all.map((s) => (
                <tr key={s.id}>
                  <td>{title(s.id)}</td>
                  <td className={styles.mono}>{nums(s)}</td>
                  <td>{isOpen(s.id) ? (meaning(s) ?? "—") : DP.inFull[L]}</td>
                </tr>
              ))}
              <tr>
                <td><a href={printing ? undefined : "#pair-business"}>{DP.business.title[L]}</a></td>
                <td className={styles.mono}>{`${bizDate.day}.${bizDate.month}.${bizDate.year}`}</td>
                <td>{DP.business.count[L](BUSINESS_SPHERES.length - bizLocked.length, BUSINESS_SPHERES.length)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <section className={styles.reading} id="pair-reading">
        <div className={styles.readingHead}>
          <h2>{DP.readingTitle[L]}</h2>
          <span className={styles.dim}>
            {mode === "full" ? DP.openCount[L](all.length) : DP.freeCount[L](opened.length, locked.length)}
          </span>
        </div>
        <div className={styles.sections}>
          {all.filter((s) => isOpen(s.id)).map((s) => section(s, all.indexOf(s)))}
          {chakraReading ? (
            <details className={styles.sec} open id="sec-chakras" data-sec="chakras">
              <summary>
                <span className={styles.secN}>{all.length + 1}</span>{DP.chakras.title[L]}
                <span className={`${styles.secNums} ${styles.mono}`}>{chakraNums}</span>
              </summary>
              <ChakraReadingView reading={chakraReading} locale={L} printing={printing} linkHref={href} />
            </details>
          ) : null}
          {mode === "free" ? (
            <>
              <div className={styles.locks} id="buy" data-testid="pair-locks" data-locked="true">
                {locked.map((s) => lockedBlock(s.id, title(s.id), DP.sphere[s.id].lead[L],
                  <LockedCards locale={L} cards={sphereCards(s)} />))}
                {lockedBlock("chakras", DP.chakras.title[L], DP.chakras.lockedLead[L],
                  <ChakraReadingView reading={lockedPairChakraReading(L, dates)} locale={L} printing={printing} linkHref={href}
                    unlock={buying ? (className, label) => <BuyLink className={className} href={props.buyHref!} analytics={{ tariff: "pair", place: "pair-chakra", section: "chakras" }}>{label}</BuyLink> : undefined} />)}
              </div>
              {bizSection}
              {props.open ? (
                <div className={`${styles.card} ${styles.cta}`} data-testid="pair-cta">
                  <div><h3>{DP.ctaTitle[L]}</h3><p className={styles.dim}>{DP.ctaText[L](locked.length + bizLocked.length)}</p></div>
                  {props.open}
                </div>
              ) : props.buyHref ? props.plans ?? null : null}
            </>
          ) : bizSection}
          {example ? (
            <div className={`${styles.card} ${styles.cta}`} data-testid="pair-example-cta">
              <div><h3>{DP.example[L]}</h3><p className={styles.dim}>{DP.exampleCta[L]}</p></div>
              <a className={`${styles.btn} ${styles.btnGold}`} href="#pair-form">{DP.exampleButton[L]}</a>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
