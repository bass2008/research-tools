import type { Metadata } from "next";
import Link from "next/link";

import { D, L } from "@/lib/i18n";
import { positionHref } from "@/lib/publicSpec";

import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import Price, { PriceOrFree } from "@/components/pay/Price";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";

import { buildYear, calendarYear, decadeExample } from "@/lib/yearExample";

import { arcanumTitle } from "@/lib/arcana";
import { categoryHub, yearArcanum, yearKeys } from "@/lib/content";
import { YEAR_HUB, arcanumHref, yearHref } from "@/lib/encyclopedia";
import { articleLd, itemListLd } from "@/lib/schema";
import { clip } from "@/lib/text";
import { pageMeta } from "@/lib/site";
import { encyclopediaSection } from "@/lib/encyclopediaNavigation";

const KEY = "year";

const HUB = categoryHub(KEY);
if (!HUB) throw new Error(`нет канонического материала хаба ${KEY}`);

export const metadata: Metadata = pageMeta({
  title: HUB.seo.title,
  description: HUB.seo.description,
  path: YEAR_HUB,
  article: true,
});

export default function YearHubPage() {
  const hub = HUB!;
  // Год берётся на сборке, а не от даты публикации корпуса: иначе с первого января хаб утверждал
  // бы прошлогодний аркан, пока кто-нибудь не сдвинет `CONTENT_PUBLISHED`.
  const math = calendarYear(buildYear());
  const example = decadeExample(math.arcanum);
  const keys = yearKeys();
  const arcana = keys
    .map((key) => ({ key, n: /^\d{1,2}$/.test(key) ? Number(key) : null }))
    .filter((x) => x.n !== null && x.n >= 1 && x.n <= 22)
    .sort((a, b) => (a.n as number) - (b.n as number));
  const stamps = keys.filter((key) => /^\d{4}$/.test(key));

  return (
    <>
        <JsonLd
          data={articleLd({
            headline: hub.seo.title,
            description: hub.seo.description,
            path: YEAR_HUB,
          })}
        />
        {arcana.length ? (
          <JsonLd
            data={itemListLd({
              name: D.encYear.yearArcana[L],
              items: arcana.map((a) => ({
                name: D.encYear.yearOf[L](String(a.key)),
                path: yearHref(a.key),
              })),
            })}
          />
        ) : null}

        <CrumbsLd
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          { name: encyclopediaSection("yer").title },
        ]}
      />

        <h1>{hub.title}</h1>
        <p className="dim prose">{hub.short}</p>

        <Sections items={hub.sections} />

        {/* Расчёт живёт на хабе, а не на 23 страницах арканов: одинаковый блок на каждой поднимал
            их похожесть между собой с 10,9 до 21,5 процента, а это лучший по различимости раздел
            сайта и единственный с полной индексацией. Здесь же он к месту — на сам хаб идёт
            отдельный спрос «матрица судьбы рассчитать на год», 905 показов в месяц. */}
        <div className="panel section-gap" id="raschet">
          <h2>{D.encYear.howToCount[L]}</h2>
          <div className="cap">{D.encYear.howToCountHint[L]}</div>
          <p>
            <b>{D.encYear.calendarArcanum[L]}</b>
            {D.encYear.calendarText[L](
              math.year,
              math.digits,
              math.sum,
              math.sum === math.arcanum ? "" : D.encYear.thatIs[L](math.arcanum),
              math.arcanum,
              arcanumTitle(math.arcanum),
            )}
          </p>
          <p>
            <b>{D.encYear.personalArcanum[L]}</b>
            {D.encYear.personalText[L]}
            {example
              ? D.encYear.exampleText[L](
                  example.birth,
                  D.encYear.yearsCount[L](example.age),
                  example.from,
                  example.to,
                  example.label,
                )
              : null}
          </p>
          <p className="small" style={{ marginBottom: 0 }}>{D.encYear.sectorNote[L]}</p>
        </div>

        <div className="section-gap">
          <CalcPromo
            title={D.enc.buildYourChart[L]}
            // Персональный год движок не считает вовсе: обещать его расчёт нельзя, пока такого
            // раздела нет ни в бесплатной части, ни в платной.
            lead={D.encYear.promoLead[L]}
            place="na-god-hub"
          />
        </div>

        {arcana.length ? (
          <div className="panel section-gap">
            <h2>{D.encYear.allArcanaInYear[L]}</h2>
            <div className="cap">{D.encYear.allArcanaInYearHint[L]}</div>
            <div className="cardgrid">
              {arcana.map((a) => (
                <Link className="ecard" key={a.key} href={yearHref(a.key)} prefetch={false}>
                  <div className="num">{D.encYear.yearOf[L](String(a.key))}</div>
                  <div className="nm">{arcanumTitle(a.n as number)}</div>
                  <div className="ds">{clip(yearArcanum(a.key)?.short ?? "", 120)}</div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {stamps.length ? (
          <div className="panel section-gap">
            <h3>{D.encYear.yearForecast[L]}</h3>
            <div className="cap">{D.encYear.yearForecastHint[L]}</div>
            <div className="taglist">
              {stamps.map((key) => (
                <Link key={key} href={yearHref(key)} prefetch={false}>
                  {D.encYear.matrixForKey[L](key)}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <Faq items={hub.faq} />

        <Related path={YEAR_HUB} refs={hub.related} />

        {/* Год и десятилетие отвечают на разные вопросы, и перелинковка между ними была
            односторонней: статья десятилетий сюда не вела, а отсюда — тем более. */}
        <div className="panel section-gap">
          <h3>{D.encYear.decadeBackground[L]}</h3>
          <div className="cap">{D.encYear.decadeBackgroundHint[L]}</div>
          <p className="prose">
            {D.encYear.decadeBackgroundLead[L]}{" "}
            <Link href={positionHref("years")}>{D.encYear.decadeBackgroundLink[L]}</Link>{" "}
            {D.encYear.decadeBackgroundTail[L]}
          </p>
        </div>

        <div className="panel section-gap">
          <h3>{D.encYear.outsideYearFrame[L]}</h3>
          <div className="cap">{D.encYear.outsideYearFrameHint[L]}</div>
          <div className="taglist">
            {Array.from({ length: 22 }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={arcanumHref(n)}>
                {n} · {arcanumTitle(n)}
              </Link>
            ))}
          </div>
        </div>

        <div className="allbox">
          <h3>{D.encYear.buildYourChart[L]}</h3>
          <p>
            {D.encYear.yearFrameLead[L]} {D.encYear.fullReadingAll[L]} <PriceOrFree />.
          </p>
          <Link className="btn" href="/#calc">
            {D.matrixPages.calcFree[L]}
          </Link>
        </div>
    </>
  );
}
