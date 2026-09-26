import { requestSite } from "@/lib/siteProfile.server";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import ChakraTable from "@/components/matrix/ChakraTable";
import Octagram from "@/components/matrix/Octagram";
import SectionEncyclopediaLinks from "@/components/matrix/SectionEncyclopediaLinks";
import Price from "@/components/pay/Price";
import Crumbs from "@/components/ui/Crumbs";
import JsonLd from "@/components/ui/JsonLd";
import { ALL_FREE } from "@/lib/access";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import type { Matrix } from "@/lib/matrix";
import { forLocale as localizedPublicSpec } from "@/lib/publicSpec";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSections } from "@/lib/sections";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { forLocale as localizedMatrices } from "../matrices";

type Params = { slug: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

const forLocale = localized((L: Locale, site) => {
  const { arcanumShort, arcanumTitle } = localizedArcana(L);
  const { matrixItem, matrixSlugs } = localizedContent(L);
  const { POSITIONS, arcanumHref, chakraHref, positionHref } = localizedEncyclopedia(L);
  const { build, withPositionArticles } = localizedSections(L);
  const { POINT_KEYS } = localizedPublicSpec(L);
  const { pageMeta } = localizedSite(L, site);
  const { articleLd } = localizedSchema(L, site);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { MONTHS_GEN, MONTHS_NOM, birthDates, matrixHref, parseSlug, sameDayMonth, sameDayYear, sameMonthYear } = localizedMatrices(L);

  // в феврале 28 дней, в апреле, июне, сентябре и ноябре — 30: иначе пояснение обещало «30 февраля»
  const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const DATES_SHOWN = 12;

  // Только точки, которые лежат в расчёте отдельным числом: таблица читает матрицу по ключу.
  // Партнёрская точка R1 живёт внутри линии отношений, её строка тут появиться не может —
  // зато сама линия отношений печатается ниже целиком.
  const SCALAR_POINTS = new Set<string>(POINT_KEYS);

  const POINT_POSITIONS = POSITIONS.filter((p) => p.kind === "point" && SCALAR_POINTS.has(p.key));

  // Линии карты: третий аркан в каждой — итог, поэтому он выделен золотым.
  const LINES: Array<[string, string, (m: Matrix) => number[]]> = [
    [D.matrixPages.lineMoney[L], D.matrixPages.lineMoneyHint[L], (m) => m.money],
    [D.matrixPages.lineRelations[L], D.matrixPages.lineRelationsHint[L], (m) => m.love],
    [D.matrixPages.lineTalents[L], D.matrixPages.lineTalentsHint[L], (m) => m.talent],
    [D.matrixPages.lineSkyGround[L], D.matrixPages.lineSkyGroundHint[L],
    (m) => [m.sky[2], m.ground[2], m.harmony]],
    [D.matrixPages.lineFamily[L], D.matrixPages.lineFamilyHint[L],
    (m) => [m.social_male[2], m.social_female[2], m.planetary]],
    [D.matrixPages.lineTail[L], D.matrixPages.lineTailHint[L], (m) => m.karmic_tail],
  ];

  function seo(slug: string) {
    const item = matrixItem(slug);
    const key = parseSlug(slug);
    if (!item || !key) return null;
    const m = item.matrix;
    const dates = birthDates(key);
    // Заголовок короткий намеренно: layout дописывает « — Матрица судьбы», а выдача режет
    // всё после ~70 знаков. Остальные арканы уходят в description.
    const title = D.matrixPages.pageTitle[L](slug, m.center, arcanumTitle(m.center));
    const description = D.matrixPages.pageDescription[L](
      slug, key.day, key.month, key.year,
      `${m.center} ${arcanumTitle(m.center)}`,
      `${m.mission} ${arcanumTitle(m.mission)}`,
      m.money[0], m.love[0],
      D.matrixPages.datesCount[L](dates.length),
    );
    return { item, key, m, dates, title, description };
  }
  return { arcanumShort, arcanumTitle, matrixItem, matrixSlugs, POSITIONS, arcanumHref, chakraHref, positionHref, build, withPositionArticles, POINT_KEYS, pageMeta, articleLd, NOT_FOUND_META, MONTHS_GEN, MONTHS_NOM, birthDates, matrixHref, parseSlug, sameDayMonth, sameDayYear, sameMonthYear, DAYS_IN_MONTH, DATES_SHOWN, SCALAR_POINTS, POINT_POSITIONS, LINES, seo };
});

export function generateStaticParams(): Params[] {
  const L = defaultLocale;
  const { matrixSlugs } = forLocale(L);

  return matrixSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const L = await publicLocale();
  const { pageMeta, NOT_FOUND_META, matrixHref, seo } = forLocale(L, await requestSite());

  const data = seo((await params).slug);
  // Пустые метаданные оставляли на 404 заголовок главной: в истории браузера и в выдаче
  // несуществующая страница выглядела как главная.
  if (!data) return NOT_FOUND_META;
  return pageMeta({
    title: data.title,
    description: data.description,
    path: matrixHref(data.item.slug),
    // страница отдаёт schema.org Article — og:type должен утверждать то же самое
    article: true,
    // 5544 страницы одной формы — массив почти-дублей. Страница остаётся как результат расчёта
    // и как узел перелинковки, поэтому follow, но в индекс не идёт и в карте сайта её нет.
    noindex: true,
    follow: true,
  });
}

export default async function MatrixPage({ params }: { params: Promise<Params> }) {
  const L = await requestLocale();
  const { arcanumShort, arcanumTitle, arcanumHref, positionHref, build, withPositionArticles, articleLd, MONTHS_GEN, MONTHS_NOM, matrixHref, sameDayMonth, sameDayYear, sameMonthYear, DAYS_IN_MONTH, DATES_SHOWN, POINT_POSITIONS, LINES, seo } = forLocale(L, await requestSite());

  const data = seo((await params).slug);
  if (!data) notFound();
  const { item, key, m, dates, title, description } = data;
  const slug = item.slug;

  const sections = withPositionArticles(m, build(m, ALL_FREE));
  const free = sections.filter((s) => s.access === "free");
  const paid = sections.filter((s) => s.access === "paid");
  const monthName = MONTHS_NOM[key.month - 1];

  return (
    <main id="content" className="page">
      <div className="wrap">
        <JsonLd data={articleLd({ headline: title, description, path: matrixHref(slug) })} />

        <Crumbs locale={L}
          trail={[
            { name: D.nav.home[L], path: "/" },
            { name: D.nav.allMatrices[L], path: "/matrix" },
            { name: slug },
          ]}
        />

        <h1>{D.matrixPages.h1[L](slug)}</h1>
        <div className="matrixcards">
          <Link className="cardlink" href={arcanumHref(m.center)}>
            <ArcanumCard locale={L} n={m.center} size="grid" eager decorative />
            <span>
              {D.matrixPages.centreCard[L]} · {m.center} {D.common.quoted[L](arcanumTitle(m.center))}
            </span>
          </Link>
          <Link className="cardlink" href={arcanumHref(m.mission)}>
            <ArcanumCard locale={L} n={m.mission} size="grid" eager decorative />
            <span>
              {D.matrixPages.missionCard[L]} · {m.mission} {D.common.quoted[L](arcanumTitle(m.mission))}
            </span>
          </Link>
        </div>
        <p className="dim prose">
          {D.matrixPages.slugLead[L](
            key.day, key.month, monthName, key.year,
            `${m.center} ${D.common.quoted[L](arcanumTitle(m.center))}`,
            `${m.mission} ${D.common.quoted[L](arcanumTitle(m.mission))}`,
          )}{" "}
          <Link href="/#calc">{D.matrixPages.enterBirthDate[L]}</Link>{" "}
          {D.matrixPages.runsInBrowser[L]}
        </p>

        <div className="rgrid section-gap">
          <div className="panel">
            <h2>{D.matrixPages.octagramTitle[L]}</h2>
            <div className="cap">
              {D.matrixPages.octagramHint[L]}
            </div>
            <Octagram locale={L} m={m} linked={false} />
          </div>

          <div>
            <ChakraTable locale={L} m={m} heading="h2" />

            <div className="mini">
              {LINES.map(([label, hint, triad]) => (
                <div className="mb" key={label}>
                  <h3>{label}</h3>
                  <p>{hint}</p>
                  <div className="row">
                    {triad(m).map((v, i) => (
                      <Link
                        className={i === 2 ? "bub g" : "bub"}
                        key={`${label}-${i}`}
                        href={`/encyclopedia/arcanum/${v}`}
                      >
                        {v}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel section-gap">
          <h2>{D.matrixPages.allPositionsHere[L]}</h2>
          <div className="cap">{D.report.allPositionsHint[L]}</div>
          <div className="tabscroll">
            <table className="postab short">
              <thead>
                <tr>
                  <th>{D.report.columnPosition[L]}</th>
                  <th>{D.report.columnArcanum[L]}</th>
                  <th>{D.report.columnMeaning[L]}</th>
                </tr>
              </thead>
              <tbody>
                {POINT_POSITIONS.map((p) => {
                  const v = (m as unknown as Record<string, number>)[p.key];
                  return (
                    <tr key={p.key}>
                      <td className="pn">
                        <Link href={positionHref(p.key)}>{p.title}</Link>
                      </td>
                      <td>
                        <span className="ar">
                          <Link href={`/encyclopedia/arcanum/${v}`}>
                            {v} · <b>{arcanumTitle(v)}</b>
                          </Link>
                        </span>
                      </td>
                      <td className="vl">{arcanumShort(v)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="section-gap">{D.matrixPages.readingHere[L]}</h2>
        <p className="dim">
          {ALL_FREE ? (
            <>{D.matrixPages.allOpenFree[L](free.length)}</>
          ) : (
            <>
              {D.matrixPages.freeOpenPaidTail[L](paid.length)} <Price locale={L} />.
            </>
          )}
        </p>
        {free.map((s) => (
          <div className="panel section-gap" key={s.key}>
            <h3>{s.title}</h3>
            <div className="cap">{s.lead}</div>
            <ul className="poslist">
              {s.positions.map((p) => (
                <li key={p.label}>
                  <Link className="bub g" href={p.href}>
                    {p.arcanum}
                  </Link>
                  <span className="lb">
                    <b>{p.label}</b> · <Link href={p.href}>{arcanumTitle(p.arcanum)}</Link> —{" "}
                    {p.text}
                    {/* Ссылка на статью про это число именно в этой точке: её считает
                        `withPositionArticles`, и без вывода она пропадала зря. */}
                    {p.article ? (
                      <>
                        {" "}
                        <Link href={p.article.href} data-entity-type="position_arcanum">
                          {p.article.label} →
                        </Link>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <SectionEncyclopediaLinks locale={L} section={s} />
          </div>
        ))}

        {paid.length ? (
          <div className="panel section-gap">
            <h2>{D.matrixPages.moreInFull[L]}</h2>
            <div className="cap">{D.matrixPages.moreInFullHint[L](paid.length)}</div>
            <div className="taglist">
              {paid.map((s) => (
                <Link key={s.key} href={positionHref(s.key)}>
                  {s.title}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="panel section-gap">
          <h2>{D.matrixPages.whichDates[L]}</h2>
          <div className="cap">
            {D.matrixPages.whichDatesHint[L](D.matrixPages.datesCount[L](dates.length))}
          </div>
          <div className="taglist">
            {dates.slice(0, DATES_SHOWN).map((d) => (
              <span key={d.iso}>{d.label}</span>
            ))}
            {dates.length > DATES_SHOWN
              ? <span>{D.matrixPages.andMore[L](dates.length - DATES_SHOWN)}</span>
              : null}
          </div>
          <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
            {key.day + 22 <= DAYS_IN_MONTH[key.month - 1]
              ? D.matrixPages.reducedSameMonth[L](key.day, key.day + 22, MONTHS_GEN[key.month - 1])
              : D.matrixPages.reducedSameYear[L](key.day, MONTHS_GEN[key.month - 1], key.year)}
          </p>
        </div>

        <div className="panel section-gap">
          <h2>{D.matrixPages.neighbours[L]}</h2>
          <div className="cap">{D.matrixPages.sameDayMonth[L]}</div>
          <div className="taglist">
            {sameDayMonth(key).map((n) => (
              <Link key={n.slug} href={matrixHref(n.slug)} prefetch={false}>
                {n.label}
              </Link>
            ))}
          </div>
          <div className="cap" style={{ marginTop: 14 }}>
            {D.matrixPages.sameDayYear[L]}
          </div>
          <div className="taglist">
            {sameDayYear(key).map((n) => (
              <Link key={n.slug} href={matrixHref(n.slug)}>
                {n.label}
              </Link>
            ))}
          </div>
          <div className="cap" style={{ marginTop: 14 }}>
            {D.matrixPages.sameMonthYear[L]}
          </div>
          <div className="taglist">
            {sameMonthYear(key).map((n) => (
              <Link key={n.slug} href={matrixHref(n.slug)}>
                {n.label}
              </Link>
            ))}
          </div>
          <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>
            <Link href="/matrix">{D.nav.allMatrices[L]}</Link> ·{" "}
            <Link href="/encyclopedia">{D.nav.encyclopedia[L]}</Link>
          </p>
        </div>

        <div className="allbox">
          <h2>{D.matrixPages.yoursMayDiffer[L]}</h2>
          <p>
            {D.matrixPages.yoursMayDifferText[L](slug)}{" "}
            {ALL_FREE ? (
              <>{D.matrixPages.chartAndAllOpen[L]}</>
            ) : (
              <>{D.matrixPages.chartAndTwoOpen[L]} <Price locale={L} />.</>
            )}
          </p>
          <Link className="btn" href="/#calc">
            {D.matrixPages.calcMine[L]}
          </Link>
        </div>
      </div>
    </main>
  );
}
