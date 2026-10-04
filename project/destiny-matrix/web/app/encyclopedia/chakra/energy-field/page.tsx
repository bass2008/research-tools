import { requestSite } from "@/lib/siteProfile.server";
import Related from "@/components/enc/Related";
import Sections, { Paragraphs } from "@/components/enc/Sections";
import { ChakraList } from "@/components/enc/lists";
import ChakraAtlasExample from "@/components/matrix/ChakraAtlasExample";
import Price from "@/components/pay/Price";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import { ALL_FREE } from "@/lib/access";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedMatrix } from "@/lib/matrix";
import { ENERGY_FIELD_HREF } from "@/lib/readingTypes";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import { exampleDay } from "@/lib/today";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const KEY = "energy-field";

const forLocale = localized((L: Locale, site) => {
  const { categoryHub } = localizedContent(L);
  const { encyclopediaSectionCrumb } = localizedEncyclopediaNavigation(L);
  const { articleLd } = localizedSchema(L, site);
  const { pageMeta } = localizedSite(L, site);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  return { article: categoryHub(KEY), encyclopediaSectionCrumb, articleLd, pageMeta, NOT_FOUND_META };
});

export async function generateMetadata(): Promise<Metadata> {
  const { article, pageMeta, NOT_FOUND_META } = forLocale(await publicLocale(), await requestSite());
  if (!article) return NOT_FOUND_META;
  return pageMeta({ title: article.seo.title, description: article.seo.description, path: ENERGY_FIELD_HREF, article: true });
}

export default async function EnergyFieldPage() {
  const L = await requestLocale();
  const site = await requestSite();
  const { article, encyclopediaSectionCrumb, articleLd } = forLocale(L, site);
  if (!article) notFound();
  const { calculate, toIso } = localizedMatrix(L);
  // Match MatrixForm's initial date; its preview then follows the saved date and edits.
  const seed = exampleDay();
  const example = calculate(toIso({ ...seed, year: seed.year - 30 }), "f");

  return (
    <>
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("chk"),
          { name: article.crumb ?? article.title },
        ]}
      />
      <JsonLd data={articleLd({ headline: article.seo.title, description: article.seo.description, path: ENERGY_FIELD_HREF })} />

      <h1>{article.title}</h1>
      <p className="dim prose">{article.short}</p>
      {article.intro.length ? <div className="section-gap"><Paragraphs items={article.intro} locale={L} /></div> : null}

      <ChakraAtlasExample site={site} locale={L} m={example}
        promoTitle={D.encChakra.promoTitle[L]} promoLead={D.enc.promoChakraLead[L]} place="energy-field" />

      <Sections items={article.sections} locale={L} />

      {article.faq.length ? <div id="questions"><Faq locale={L} items={article.faq} /></div> : null}

      <div className="panel section-gap">
        <h3>{D.enc.sevenLevels[L]}</h3>
        <ChakraList locale={L} />
      </div>

      <Related locale={L} path={ENERGY_FIELD_HREF} refs={article.related} />

      <div className="allbox">
        <h3>{D.encChakra.buildEnergyMap[L]}</h3>
        <p>
          {D.encChakra.buildEnergyMapText[L]}{" "}
          {ALL_FREE ? <>{D.encChakra.fullMapOpen[L]}</> : <>{D.encChakra.fullMapPaid[L]} <Price locale={L} />.</>}
        </p>
        <Link className="btn" href="/#calc">{D.matrixPages.calcMatrix[L]}</Link>
      </div>
    </>
  );
}
