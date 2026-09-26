import { requestSite } from "@/lib/siteProfile.server";
import CharacterReadingView from "@/components/matrix/CharacterReadingView";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedCharacter } from "@/lib/character";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedMethodLabels } from "@/lib/i18n/methodLabels";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedPublicSpec } from "@/lib/publicSpec";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Params = { triple: string };

// 5 544 персональных статей собираются на запрос и закрыты от индексации. Они живут в
// энциклопедии как толкования, а не в /matrix, который оставлен результату калькулятора.
export const dynamic = "force-dynamic";

const forLocale = localized((L: Locale, site) => {
  const { sectionLabels } = localizedMethodLabels(L);
  const { buildCharacterReading } = localizedCharacter(L);
  const { matrixItem } = localizedContent(L);
  const { encyclopediaSectionCrumb } = localizedEncyclopediaNavigation(L);
  const { positionHref } = localizedPublicSpec(L);
  const { articleLd } = localizedSchema(L, site);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { pageMeta } = localizedSite(L, site);

  function data(triple: string) {
    const item = matrixItem(triple);
    if (!item) return null;
    const reading = buildCharacterReading(item.matrix);
    const path = `/encyclopedia/character/${triple}`;
    const description =
      D.encCharacter.description[L](triple);
    return { item, reading, path, description };
  }
  return { sectionLabels, buildCharacterReading, matrixItem, encyclopediaSectionCrumb, positionHref, articleLd, NOT_FOUND_META, pageMeta, data };
});

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const L = await publicLocale();
  const { NOT_FOUND_META, pageMeta, data } = forLocale(L, await requestSite());

  const value = data((await params).triple);
  if (!value) return NOT_FOUND_META;
  return pageMeta({
    title: value.reading.title,
    description: value.description,
    path: value.path,
    article: true,
    noindex: true,
    follow: true,
  });
}

export default async function CharacterPage({ params }: { params: Promise<Params> }) {
  const L = await requestLocale();
  const { sectionLabels, encyclopediaSectionCrumb, positionHref, articleLd, data } = forLocale(L, await requestSite());

  const value = data((await params).triple);
  if (!value) notFound();
  const { item, reading, path, description } = value;

  return (
    <>
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("sec"),
          { name: sectionLabels("character").title, path: positionHref("character") },
          { name: item.slug },
        ]}
      />
      <JsonLd data={articleLd({ headline: reading.title, description, path })} />

      <p className="eyebrow">{D.encCharacter.personalSection[L](item.slug)}</p>
      <h1>{reading.title}</h1>
      <p className="dim prose">{reading.lead}</p>

      <CharacterReadingView locale={L} reading={reading} />

      <div className="allbox">
        <h2>{D.encCharacter.pointsTitle[L]}</h2>
        <p>
          {D.encCharacter.pointsText[L](item.slug)}
        </p>
        <div className="btnrow center">
          <Link className="btn" href={positionHref("character")}>
            {D.sheet.openSectionArticle[L]}
          </Link>
          <Link className="btn ghost" href={`/matrix/${item.slug}`}>
            {D.encCharacter.backToMatrix[L]}
          </Link>
          <Link className="btn ghost" href="/#calc">
            {D.sheet.otherDate[L]}
          </Link>
        </div>
      </div>
    </>
  );
}
