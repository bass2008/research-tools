import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { D, L } from "@/lib/i18n";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import Price, { PriceOrFree } from "@/components/pay/Price";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";

import { arcanumShort, arcanumTitle } from "@/lib/arcana";
import { yearArcanum, yearKeys } from "@/lib/content";
import { YEAR_HUB, arcanumHref, yearHref } from "@/lib/encyclopedia";
import { articleLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";
import { pageMeta } from "@/lib/site";
import { encyclopediaSectionCrumb } from "@/lib/encyclopediaNavigation";

type Params = { key: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return yearKeys().map((key) => ({ key }));
}

/** Аркан (1…22) или год-штамп (2026): от этого зависит, показывать карту аркана или нет. */
function arcanumOf(key: string): number | null {
  if (!/^\d{1,2}$/.test(key)) return null;
  const n = Number(key);
  return n >= 1 && n <= 22 ? n : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const item = yearArcanum((await params).key);
  if (!item) return NOT_FOUND_META;
  return pageMeta({
    title: item.seo.title,
    description: item.seo.description,
    path: yearHref(item.key),
    article: true,
  });
}

export default async function YearPage({ params }: { params: Promise<Params> }) {
  const key = (await params).key;
  const item = yearArcanum(key);
  if (!item) notFound();
  const n = arcanumOf(item.key);
  // Ключи — строки, и сортировка по ним ставила «2» после «19»; обрезка на двенадцати выбрасывала
  // арканы 3–8 из блока вовсе. Сортируем числом и показываем все.
  const siblings = yearKeys()
    .map((k) => ({ key: k, n: arcanumOf(k) }))
    .filter((x) => x.n !== null && x.key !== item.key)
    .sort((a, b) => (a.n as number) - (b.n as number));

  return (
    <>
        <JsonLd
          data={articleLd({
            headline: item.seo.title,
            description: item.seo.description,
            path: yearHref(item.key),
            keywords: item.seo.queries,
          })}
        />
      <CrumbsLd
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("yer"),
          { name: /^\d{4}$/.test(key) ? D.encYear.matrixForYear[L](key) : D.encYear.yearOf[L](key) },
        ]}
      />

        {n ? (
          <div className="arc-top">
            <figure className="arc-side">
              <ArcanumCard n={n} size="grid" eager decorative />
              <figcaption className="arc-cap">
                {n} · {arcanumTitle(n)}
              </figcaption>
            </figure>
            <div className="arc-body">
              <h1>{item.title}</h1>
              <p className="hero-lead">{arcanumShort(n)}</p>
            </div>
          </div>
        ) : (
          <h1>{item.title}</h1>
        )}

        <p className="dim prose">{item.short}</p>

        <Sections items={item.sections} />


        <div className="section-gap">
          <CalcPromo
            arcanum={n ?? undefined}
            title={D.enc.buildYourChart[L]}
            lead={D.encYear.promoLead[L]}
            place="year"
          />
        </div>

        <Faq items={item.faq} />

        {n ? (
          <div className="panel section-gap">
            <h3>{D.encYear.sameArcanumInChart[L]}</h3>
            <div className="cap">{D.encYear.sameArcanumHint[L]}</div>
            <p className="small" style={{ margin: 0 }}>
              <Link href={arcanumHref(n)}>
                {D.encYear.inMatrix[L](n, arcanumTitle(n))}
              </Link>
            </p>
          </div>
        ) : null}

        <Related path={yearHref(item.key)} refs={item.related} />

        {siblings.length ? (
          <div className="panel section-gap">
            <h3>{D.encYear.otherYearArcana[L]}</h3>
            <div className="cap">{D.encYear.otherYearArcanaHint[L]}</div>
            <div className="taglist">
              {siblings.map((s) => (
                <Link key={s.key} href={yearHref(s.key)}>
                  {s.key} · {arcanumTitle(s.n as number)}
                </Link>
              ))}
              <Link href={YEAR_HUB}>{D.encYear.allYearArcana[L]}</Link>
            </div>
          </div>
        ) : null}

        <div className="allbox">
          <h3>{D.encYear.buildBirthChart[L]}</h3>
          <p>
            {D.encYear.yearFrameLeadKey[L]} {D.encArcanum.fullReadingAll[L]} <PriceOrFree />.
          </p>
          <Link className="btn" href="/#calc">
            {D.matrixPages.calcFree[L]}
          </Link>
        </div>
    </>
  );
}
