import { requestSite } from "@/lib/siteProfile.server";
import PersonalSectionArticle from "@/components/matrix/PersonalSectionArticle";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedMethodLabels } from "@/lib/i18n/methodLabels";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedPublicSpec } from "@/lib/publicSpec";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSectionReadings } from "@/lib/sectionReadings";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Params = { triple: string };

// Набор из 286 адресов конечен: неизвестный ключ получает штатный 404. Страницы остаются
// noindex/follow и не входят в sitemap независимо от способа рендера.
export const dynamicParams = false;

const forLocale = localized((L: Locale, site) => {
  const { sectionLabels } = localizedMethodLabels(L);
  const { encyclopediaSectionCrumb } = localizedEncyclopediaNavigation(L);
  const { positionHref } = localizedPublicSpec(L);
  const { articleLd } = localizedSchema(L, site);
  const { buildSectionReading, sectionReadingItem, sectionReadingSlugs } = localizedSectionReadings(L);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { pageMeta } = localizedSite(L, site);

  function data(triple: string) {
    const item = sectionReadingItem("comfort", triple);
    if (!item) return null;
    const reading = buildSectionReading("comfort", item.matrix);
    const path = `/encyclopedia/comfort/${triple}`;
    const description =
      D.encLinks.comfortDescription[L](triple);
    return { reading, path, description };
  }
  return { sectionLabels, encyclopediaSectionCrumb, positionHref, articleLd, buildSectionReading, sectionReadingItem, sectionReadingSlugs, NOT_FOUND_META, pageMeta, data };
});

export function generateStaticParams(): Params[] {
  const L = defaultLocale;
  const { sectionReadingSlugs } = forLocale(L);

  return sectionReadingSlugs("comfort").map((triple) => ({ triple }));
}

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

export default async function ComfortReadingPage({ params }: { params: Promise<Params> }) {
  const L = await requestLocale();
  const { sectionLabels, encyclopediaSectionCrumb, positionHref, articleLd, data } = forLocale(L, await requestSite());

  const value = data((await params).triple);
  if (!value) notFound();
  const { reading, path, description } = value;
  return (
    <>
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("sec"),
          { name: sectionLabels("comfort").title, path: positionHref("comfort") },
          { name: reading.slug },
        ]}
      />
      <JsonLd data={articleLd({ headline: reading.title, description, path })} />
      <PersonalSectionArticle locale={L}
        sectionKey="comfort"
        sectionTitle={sectionLabels("comfort").title}
        reading={reading}
      />
    </>
  );
}
