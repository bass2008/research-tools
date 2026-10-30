import { requestSite } from "@/lib/siteProfile.server";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
import { COMPATIBILITY_HUBS } from "@/lib/contentReader";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { DP } from "@/lib/i18n/dict/pair";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "@/components/ui/LocalizedLink";
import { notFound } from "next/navigation";

type Params = { n: string };

export const dynamicParams = false;

const forLocale = localized((L: Locale, site) => {
  const { arcanumTitle } = localizedArcana(L);
  const { compatibilityArcanum, compatibilityKeys } = localizedContent(L);
  const { COMPATIBILITY_HUB, arcanumHref, compatibilityHref } = localizedEncyclopedia(L);
  const { articleLd } = localizedSchema(L, site);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { pageMeta } = localizedSite(L, site);
  const { encyclopediaSectionCrumb } = localizedEncyclopediaNavigation(L);
  return { arcanumTitle, compatibilityArcanum, compatibilityKeys, COMPATIBILITY_HUB, arcanumHref, compatibilityHref, articleLd, NOT_FOUND_META, pageMeta, encyclopediaSectionCrumb };
});

export function generateStaticParams(): Params[] {
  return forLocale(defaultLocale).compatibilityKeys().map((n) => ({ n }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const L = await publicLocale();
  const { compatibilityArcanum, compatibilityHref, NOT_FOUND_META, pageMeta } = forLocale(L, await requestSite());
  const item = compatibilityArcanum((await params).n);
  if (!item) return NOT_FOUND_META;
  return pageMeta({ title: item.seo.title, description: item.seo.description, path: compatibilityHref(item.key), article: true });
}

export default async function CompatibilityArcanumPage({ params }: { params: Promise<Params> }) {
  const L = await requestLocale();
  const { arcanumTitle, compatibilityArcanum, compatibilityKeys, COMPATIBILITY_HUB, arcanumHref, compatibilityHref, articleLd, encyclopediaSectionCrumb } = forLocale(L, await requestSite());

  const item = compatibilityArcanum((await params).n);
  if (!item) notFound();
  const n = Number(item.key);
  const siblings = compatibilityKeys().map(Number).filter((k) => k !== n);

  return (
    <>
      <JsonLd data={articleLd({ headline: item.seo.title, description: item.seo.description, path: compatibilityHref(n), keywords: item.seo.queries })} />
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("cmp"),
          { name: DP.encCompat.pageCrumb[L](n, arcanumTitle(n)) },
        ]}
      />

      <div className="arc-top">
        <figure className="arc-side">
          <ArcanumCard locale={L} n={n} size="grid" eager decorative />
          <figcaption className="arc-cap">{n} · {arcanumTitle(n)}</figcaption>
        </figure>
        <div className="arc-body">
          <h1>{item.title}</h1>
          <p className="hero-lead">{item.short}</p>
        </div>
      </div>

      <Sections items={item.sections} locale={L} />

      <div className="allbox section-gap">
        <h3>{DP.encCompat.calcTitle[L]}</h3>
        <p>{DP.encCompat.calcLead[L]}</p>
        <Link className="btn" href="/compatibility">{DP.encCompat.calcButton[L]}</Link>
      </div>

      <Faq locale={L} items={item.faq} />

      <div className="panel section-gap">
        <h3>{DP.encCompat.inPersonalHint[L]}</h3>
        <p className="small" style={{ margin: 0 }}>
          <Link href={arcanumHref(n)}>{DP.encCompat.inPersonal[L](n, arcanumTitle(n))}</Link>
        </p>
      </div>

      <Related locale={L} path={compatibilityHref(n)} refs={[...item.related, ...COMPATIBILITY_HUBS, "compatibility-tails"]} />

      {siblings.length ? (
        <div className="panel section-gap">
          <h3>{DP.encCompat.others[L]}</h3>
          <div className="taglist">
            {siblings.map((k) => <Link key={k} href={compatibilityHref(k)}>{k} · {arcanumTitle(k)}</Link>)}
            <Link href={COMPATIBILITY_HUB}>{DP.encCompat.all[L]}</Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
