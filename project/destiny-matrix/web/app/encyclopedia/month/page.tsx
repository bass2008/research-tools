import { requestSite } from "@/lib/siteProfile.server";
import Related from "@/components/enc/Related";
import Sections, { Paragraphs } from "@/components/enc/Sections";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import Link from "@/components/ui/LocalizedLink";
import { articleContentForLocale as localizedContent } from "@/app/_lib/article";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { MONTH_HREF } from "@/lib/readingTypes";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const KEY = "month";

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
  return pageMeta({ title: article.seo.title, description: article.seo.description, path: MONTH_HREF, article: true });
}

export default async function MonthPage() {
  const L = await requestLocale();
  const { article, encyclopediaSectionCrumb, articleLd } = forLocale(L, await requestSite());
  if (!article) notFound();

  return (
    <>
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("art"),
          { name: article.crumb ?? article.title },
        ]}
      />
      <JsonLd data={articleLd({ headline: article.seo.title, description: article.seo.description, path: MONTH_HREF })} />

      <h1>{article.title}</h1>
      <p className="dim prose">{article.short}</p>
      {article.intro.length ? <div className="section-gap"><Paragraphs items={article.intro} locale={L} /></div> : null}

      <Sections items={article.sections} locale={L} />

      {article.faq.length ? <div id="questions"><Faq locale={L} items={article.faq} /></div> : null}

      <Related locale={L} path={MONTH_HREF} refs={article.related} />

      <div className="allbox">
        <h3>{D.encYear.monthYearTitle[L]}</h3>
        <p>{D.encYear.monthYearText[L]}</p>
        <Link className="btn" href="/matrix/individual-example/year">{D.encYear.monthYearExample[L]}</Link>
      </div>
    </>
  );
}
