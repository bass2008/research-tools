import { requestSite } from "@/lib/siteProfile.server";
import PositionMap from "@/components/enc/PositionMap";
import Sections from "@/components/enc/Sections";
import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedMatrixMap } from "@/lib/matrixMap";
import { forLocale as localizedPositionArcanum } from "@/lib/positionArcanum";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import { forLocale as localizedText } from "@/lib/text";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Params = { key: string; n: string };

// Набор адресов конечен и задан реестром: какие пересечения бывают, решает метод, а спрос
// решает только, видит ли их поиск. Плоские 22 × 38 адресов были бы тем тонким корпусом,
// который уже дал 76 страниц хвостов на один показ за шесть дней.
export const dynamicParams = false;

const forLocale = localized((L: Locale, site) => {
  const { arcanumTitle } = localizedArcana(L);
  const { arcanumHref, positionByKey } = localizedEncyclopedia(L);
  const { buildPositionArcanum, positionArcanumHref, positionArcanumLabel, positionArcanumSiblings, registryItem, registryItems } = localizedPositionArcanum(L);
  const { encyclopediaSectionCrumb } = localizedEncyclopediaNavigation(L);
  const { articleLd, faqLd } = localizedSchema(L, site);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { mapPointsFor } = localizedMatrixMap(L);
  const { pageMeta } = localizedSite(L, site);
  const { clip } = localizedText(L);

  function data(params: Params) {
    const arcanum = Number(params.n);
    if (!Number.isInteger(arcanum)) return null;
    if (!registryItem(params.key, arcanum)) return null;
    return buildPositionArcanum(params.key, arcanum);
  }
  return { arcanumTitle, arcanumHref, positionByKey, buildPositionArcanum, positionArcanumHref, positionArcanumLabel, positionArcanumSiblings, registryItem, registryItems, encyclopediaSectionCrumb, articleLd, faqLd, NOT_FOUND_META, mapPointsFor, pageMeta, clip, data };
});

export function generateStaticParams(): Params[] {
  const L = defaultLocale;
  const { registryItems } = forLocale(L);

  return registryItems().map((item) => ({ key: item.position, n: String(item.arcanum) }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const L = await publicLocale();
  const { positionArcanumHref, registryItem, NOT_FOUND_META, pageMeta, data } = forLocale(L, await requestSite());

  const resolved = await params;
  const reading = data(resolved);
  if (!reading) return NOT_FOUND_META;
  const item = registryItem(reading.position, reading.arcanum);
  return pageMeta({
    title: reading.seo.title,
    description: reading.seo.description,
    path: positionArcanumHref(reading.position, reading.arcanum),
    article: true,
    noindex: !item?.publication.index,
    follow: item?.publication.follow ?? true,
  });
}

export default async function PositionArcanumPage({ params }: { params: Promise<Params> }) {
  const L = await requestLocale();
  const { arcanumTitle, arcanumHref, positionByKey, positionArcanumHref, positionArcanumLabel, positionArcanumSiblings, encyclopediaSectionCrumb, articleLd, faqLd, mapPointsFor, clip, data } = forLocale(L, await requestSite());

  const reading = data(await params);
  if (!reading) notFound();
  const place = positionByKey(reading.position);
  const path = positionArcanumHref(reading.position, reading.arcanum);
  const siblings = positionArcanumSiblings(reading.position, reading.arcanum);
  // У пересечения та же схема, что у обзора позиции: вопрос «где это в карте» одинаков.
  const spots = mapPointsFor(reading.mapKeys);

  return (
    <>
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb(place?.kind === "section" ? "sec" : "pts"),
          { name: reading.positionTitle, path: reading.positionHref },
          { name: reading.title },
        ]}
      />
      <JsonLd
        data={articleLd({ headline: reading.seo.title, description: reading.seo.description, path })}
      />
      {reading.faq.length ? <JsonLd data={faqLd(reading.faq)} /> : null}

      <h1>{reading.title}</h1>
      <p className="dim prose">{reading.short}</p>

      <PositionMap locale={L}
        highlight={spots}
        caption={spots.length === 1
          ? D.encPosition.whereOnePoint[L](`${spots[0]!.label} · ${spots[0]!.symbol}`)
          : D.encPosition.whereSeveralPoints[L](
            spots.map((x) => `${x.label} · ${x.symbol}`).join(", "),
          )}
      />

      <Sections items={reading.sections} />

      {reading.tails.length ? (
        <div className="panel section-gap">
          <h2>{D.encLinks.triplesWith[L]}</h2>
          <div className="cap">
            {D.encLinks.triplesWithHint[L](reading.tails.length, reading.arcanum)}
          </div>
          <div className="cardgrid">
            {reading.tails.map((tail) => (
              <Link className="ecard" key={tail.key} href={tail.href} prefetch={false}>
                <div className="num">{tail.key}</div>
                <div className="ds">{clip(tail.short, 120)}</div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="section-gap">
        <CalcPromo locale={L}
          title={D.encLinks.promoCrossTitle[L]}
          lead={D.encLinks.promoCrossLead[L]}
          place="position-arcanum"
        />
      </div>

      <Faq locale={L} items={reading.faq} />

      <div className="panel section-gap">
        <h3>{D.encLinks.nearby[L]}</h3>
        <div className="cap">{D.encLinks.nearbyHint[L]}</div>
        <div className="taglist">
          <Link href={reading.positionHref}>{reading.positionTitle}</Link>
          <Link href={arcanumHref(reading.arcanum)}>
            {reading.arcanum} · {arcanumTitle(reading.arcanum)}
          </Link>
          {siblings.map((sib) => (
            <Link
              key={`${sib.position}-${sib.arcanum}`}
              href={positionArcanumHref(sib.position, sib.arcanum)}
              prefetch={false}
            >
              {positionArcanumLabel(sib)}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
