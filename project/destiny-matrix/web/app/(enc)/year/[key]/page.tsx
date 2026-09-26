import { requestSite } from "@/lib/siteProfile.server";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import CalcPromo from "@/components/matrix/CalcPromo";
import { PriceOrFree } from "@/components/pay/Price";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Params = { key: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

const forLocale = localized((L: Locale, site) => {
  const { arcanumShort, arcanumTitle } = localizedArcana(L);
  const { yearArcanum, yearKeys } = localizedContent(L);
  const { YEAR_HUB, arcanumHref, yearHref } = localizedEncyclopedia(L);
  const { articleLd } = localizedSchema(L, site);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { pageMeta } = localizedSite(L, site);
  const { encyclopediaSectionCrumb } = localizedEncyclopediaNavigation(L);

  /** Аркан (1…22) или год-штамп (2026): от этого зависит, показывать карту аркана или нет. */
  function arcanumOf(key: string): number | null {
    if (!/^\d{1,2}$/.test(key)) return null;
    const n = Number(key);
    return n >= 1 && n <= 22 ? n : null;
  }
  return { arcanumShort, arcanumTitle, yearArcanum, yearKeys, YEAR_HUB, arcanumHref, yearHref, articleLd, NOT_FOUND_META, pageMeta, encyclopediaSectionCrumb, arcanumOf };
});

export function generateStaticParams(): Params[] {
  const L = defaultLocale;
  const { yearKeys } = forLocale(L);

  return yearKeys().map((key) => ({ key }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const L = await publicLocale();
  const { yearArcanum, yearHref, NOT_FOUND_META, pageMeta } = forLocale(L, await requestSite());

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
  const L = await requestLocale();
  const { arcanumShort, arcanumTitle, yearArcanum, yearKeys, YEAR_HUB, arcanumHref, yearHref, articleLd, encyclopediaSectionCrumb, arcanumOf } = forLocale(L, await requestSite());

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
      <CrumbsLd locale={L}
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
            <ArcanumCard locale={L} n={n} size="grid" eager decorative />
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
        <CalcPromo locale={L}
          arcanum={n ?? undefined}
          title={D.enc.buildYourChart[L]}
          lead={D.encYear.promoLead[L]}
          place="year"
        />
      </div>

      <Faq locale={L} items={item.faq} />

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

      <Related locale={L} path={yearHref(item.key)} refs={item.related} />

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
          {D.encYear.yearFrameLeadKey[L]} {D.encArcanum.fullReadingAll[L]} <PriceOrFree locale={L} />.
        </p>
        <Link className="btn" href="/#calc">
          {D.matrixPages.calcFree[L]}
        </Link>
      </div>
    </>
  );
}
