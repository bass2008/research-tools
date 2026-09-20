import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { D, L } from "@/lib/i18n";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import CalcPromo from "@/components/matrix/CalcPromo";
import Faq from "@/components/ui/Faq";
import CrumbsLd from "@/components/ui/CrumbsLd";
import { positionHref } from "@/lib/publicSpec";
import JsonLd from "@/components/ui/JsonLd";
import Price, { PriceOrFree } from "@/components/pay/Price";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";

import { arcanumTitle } from "@/lib/arcana";
import { karmicTail, karmicTailKeys } from "@/lib/content";
import {
  KARMIC_TAIL_HUB,
  arcanumHref,
  karmicTailHref,
  parseTail,
  tailByFormula,
} from "@/lib/encyclopedia";
import { articleLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";
import { pageMeta } from "@/lib/site";
import { encyclopediaSectionCrumb } from "@/lib/encyclopediaNavigation";

type Params = { triple: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  // Корпус обязан быть полным: build-content.py проверяет точное равенство реестру метода.
  return karmicTailKeys().map((triple) => ({ triple }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const triple = (await params).triple;
  const item = karmicTail(triple);
  if (!item) return NOT_FOUND_META;
  return pageMeta({
    title: item.seo.title,
    description: item.seo.description,
    path: karmicTailHref(item.key),
    article: true,
    noindex: !item.publication.index,
    follow: item.publication.follow,
  });
}

export default async function KarmicTailPage({ params }: { params: Promise<Params> }) {
  const triple = (await params).triple;
  const item = karmicTail(triple);
  if (!item) notFound();

  const formula = tailByFormula(parseTail(item.key) ?? []);
  const displayArcana = formula?.triple ?? parseTail(item.key) ?? item.arcana;

  return (
    <>

      <CrumbsLd
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          // цепочка обязана совпадать с видимой крошкой: разное имя и разный адрес в разметке
          // означали бы, что поисковику показывают не тот путь, что человеку
          encyclopediaSectionCrumb("tls"),
          { name: item.key },
        ]}
      />
        <JsonLd
          data={articleLd({
            headline: item.seo.title,
            description: item.seo.description,
            path: karmicTailHref(item.key),
            keywords: item.seo.queries,
          })}
        />

        <h1>{item.title}</h1>
        <p className="dim prose">{item.short}</p>

        <div className="tail-deck section-gap">
          {displayArcana.map((n, i) => (
            <Link className="ecard tail-card" key={`${n}-${i}`} href={arcanumHref(n)}>
              <ArcanumCard n={n} size="big" eager={i === 0} decorative />
              <div className="tail-card-label">
                <div className="num">{D.encTail.arcanumNumber[L](n)}</div>
                <div className="nm">{arcanumTitle(n)}</div>
              </div>
            </Link>
          ))}
        </div>

        <Sections items={item.sections} />

        <div className="panel section-gap">
          <h2>{D.encTail.howCounted[L]}</h2>
          <div className="cap">{D.encTail.formulaHint[L]}</div>
          {formula ? (
            <p style={{ margin: 0 }}>
              {D.encTail.formulaHead[L]}{" "}
              <strong>{formula.triple.join("–")}</strong>
              {D.encTail.formulaTail[L](formula.sampleBirth.split("-").reverse().join("."))}
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              {D.encTail.notReachable[L]}
            </p>
          )}
        </div>

        <div className="section-gap">
          <CalcPromo
            title={D.enc.buildYourChart[L]}
            // Тройка с подписью и толкованием живёт в разделе «Задачи прошлых воплощений», а он
            // платный: обещать её в бесплатном расчёте — прямая неправда.
            lead={D.enc.promoTailLead[L]}
            place="karmic-tail"
          />
        </div>

        <Faq items={item.faq} />

        <Related
          path={karmicTailHref(item.key)}
          refs={item.related}
          hint={D.encTail.relatedHint[L]}
        />

        <div className="panel section-gap">
          <h3>{D.encTail.whereNext[L]}</h3>
          <div className="cap">{D.encTail.whereNextHint[L]}</div>
          <div className="taglist">
            {[...new Set(displayArcana)].map((n) => (
              <Link key={n} href={arcanumHref(n)}>
                {n} · {arcanumTitle(n)}
              </Link>
            ))}
            <Link href={KARMIC_TAIL_HUB}>{D.encTail.allTails[L]}</Link>
            {/* Перелинковка трёх разведённых интентов была односторонней: хаб и статья раздела
                вели сюда, а обратно на разбор метода — нет. */}
            <Link href={positionHref("past_lives")}>{D.encTail.howPastLivesRead[L]}</Link>
          </div>
        </div>

        <div className="allbox">
          {/* обещать «найдите эту тройку у себя» можно только там, где движок её вообще
              выдаёт: у половины страниц набор формулой не складывается */}
          <h3>{formula ? D.encTail.findYourTail[L] : D.encYear.buildYourChart[L]}</h3>
          <p>
            {formula ? D.encTail.octagramFree[L] : D.encTail.octagramFreeOther[L]}{" "}
            {D.encTail.tailInReading[L]} <PriceOrFree />.
          </p>
          <Link className="btn" href="/#calc">
            {D.matrixPages.calcFree[L]}
          </Link>
        </div>
    </>
  );
}
