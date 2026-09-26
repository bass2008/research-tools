import { requestSite } from "@/lib/siteProfile.server";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
import CalcPromo from "@/components/matrix/CalcPromo";
import { PriceOrFree } from "@/components/pay/Price";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import type { ArticleContent } from "@/lib/content";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const forLocale = localized((L: Locale, site) => {
  const { hubCrumb, hubHref } = localizedEncyclopedia(L);
  const { hub, hubKeys } = localizedContent(L);
  const { articleLd } = localizedSchema(L, site);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { pageMeta } = localizedSite(L, site);
  const { encyclopediaSectionCrumb } = localizedEncyclopediaNavigation(L);

  // Концепт-хаб — посадочная под именованное понятие («программы», «кармическая матрица»,
  // «энергии»). Разметка у всех одна, различается только текст, поэтому роут остаётся
  // трёхстрочным, а вёрстка живёт здесь.
  /** Метаданные статьи-хаба: у пяти страниц они собираются из одной записи `hubs.json`. */
  function hubMeta(key: string): Metadata {
    const item = hub(key);
    if (!item) return NOT_FOUND_META;
    return pageMeta({
      title: item.seo.title,
      description: item.seo.description,
      path: hubHref(key),
      article: true,
    });
  }
  return { hubCrumb, hubHref, hub, hubKeys, articleLd, NOT_FOUND_META, pageMeta, encyclopediaSectionCrumb, hubMeta };
});

export const { hubMeta } = forLocale(defaultLocale);

export default async function HubArticle({ locale: requestedLocale, ...localeProps }: ({ item: ArticleContent }) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const { item } = localeProps;
  const { hubCrumb, hubHref, hub, hubKeys, articleLd, encyclopediaSectionCrumb } = forLocale(L, await requestSite());

  const path = hubHref(item.key);

  return (
    <>
      <JsonLd
        data={articleLd({
          headline: item.seo.title,
          description: item.seo.description,
          path,
          keywords: item.seo.queries,
        })}
      />

      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("art"),
          { name: hubCrumb(item.key) },
        ]}
      />

      <h1>{item.title}</h1>
      <p className="dim prose">{item.short}</p>

      <Sections items={item.sections} />

      <div className="section-gap">
        <CalcPromo locale={L}
          title={D.octagram.hubPromoTitle[L]}
          lead={D.octagram.hubPromoLead[L]}
          place={`hub-${item.key}`}
        />
      </div>

      <Faq locale={L} items={item.faq} />

      <Related locale={L} path={path} refs={item.related} />

      <div className="panel section-gap">
        <h3>{D.octagram.hubWhereNext[L]}</h3>
        <div className="cap">{D.octagram.hubWhereNextHint[L]}</div>
        <div className="taglist">
          <Link href="/encyclopedia">{D.octagram.encTitle[L]}</Link>
          <Link href="/encyclopedia/karmic-tail">{D.octagram.karmicTail[L]}</Link>
          <Link href="/year">{D.octagram.matrixForYear[L]}</Link>
          {hubKeys()
            .filter((key) => key !== item.key)
            .map((key) => (
              <Link key={key} href={hubHref(key)}>
                {hub(key)!.title}
              </Link>
            ))}
        </div>
      </div>

      <div className="allbox">
        <h3>{D.enc.buildYourChart[L]}</h3>
        <p>
          {D.octagram.calcFreeLead[L]} {D.octagram.fullReadingAll[L]} <PriceOrFree locale={L} />.
        </p>
        <Link className="btn" href="/#calc">
          {D.matrixPages.calcFree[L]}
        </Link>
      </div>
    </>
  );
}
