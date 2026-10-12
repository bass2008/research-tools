import { requestSite } from "@/lib/siteProfile.server";
import Sections from "@/components/enc/Sections";
import { ArcanaDeck } from "@/components/enc/lists";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { DP } from "@/lib/i18n/dict/pair";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const KEY = "compatibility";

const forLocale = localized((L: Locale, site) => {
  const { arcanumTitle } = localizedArcana(L);
  const { categoryHub, compatibilityKeys } = localizedContent(L);
  const { COMPATIBILITY_HUB, compatibilityHref } = localizedEncyclopedia(L);
  const { articleLd, itemListLd } = localizedSchema(L, site);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { pageMeta } = localizedSite(L, site);
  const { encyclopediaSection } = localizedEncyclopediaNavigation(L);
  return { arcanumTitle, categoryHub, compatibilityKeys, COMPATIBILITY_HUB, compatibilityHref, articleLd, itemListLd, NOT_FOUND_META, pageMeta, encyclopediaSection };
});

export async function generateMetadata(): Promise<Metadata> {
  const L = await publicLocale();
  const { categoryHub, COMPATIBILITY_HUB, NOT_FOUND_META, pageMeta } = forLocale(L, await requestSite());
  const hub = categoryHub(KEY);
  if (!hub) return NOT_FOUND_META;
  return pageMeta({ title: hub.seo.title, description: hub.seo.description, path: COMPATIBILITY_HUB, article: true });
}

export default async function CompatibilityHubPage() {
  const L = await requestLocale();
  const { arcanumTitle, categoryHub, compatibilityKeys, COMPATIBILITY_HUB, compatibilityHref, articleLd, itemListLd, encyclopediaSection } = forLocale(L, await requestSite());

  const hub = categoryHub(KEY);
  if (!hub) notFound();
  const items = compatibilityKeys().map(Number).map((n) => ({ n }));

  return (
    <>
      <JsonLd data={articleLd({ headline: hub.seo.title, description: hub.seo.description, path: COMPATIBILITY_HUB, keywords: hub.seo.queries })} />
      <JsonLd data={itemListLd({ name: hub.title, items: items.map(({ n }) => ({ name: `${n} · ${arcanumTitle(n)}`, path: compatibilityHref(n) })) })} />
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          { name: encyclopediaSection("cmp").title },
        ]}
      />
      <h1>{hub.title}</h1>
      <p className="dim prose">{hub.short}</p>

      <div className="panel section-gap" data-testid="compatibility-deck">
        <h2>{DP.encCompat.listTitle[L]}</h2>
        <div className="cap">{DP.encCompat.deckHint[L]} · {items.length}</div>
        <ArcanaDeck locale={L} numbers={items.map(({ n }) => n)} href={compatibilityHref} />
      </div>

      <Sections items={hub.sections} locale={L} />

      <div className="allbox section-gap">
        <h3>{DP.encCompat.calcTitle[L]}</h3>
        <p>{DP.encCompat.calcLead[L]}</p>
        <Link className="btn" href="/compatibility">{DP.encCompat.calcButton[L]}</Link>
      </div>

      <Faq locale={L} items={hub.faq} />
    </>
  );
}
