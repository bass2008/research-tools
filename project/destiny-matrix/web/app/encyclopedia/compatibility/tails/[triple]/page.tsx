import { requestSite } from "@/lib/siteProfile.server";
import Sections, { Paragraphs } from "@/components/enc/Sections";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
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
import Link from "next/link";
import { notFound } from "next/navigation";

type Params = { triple: string };

export const dynamicParams = false;

const ROLES = ["taskIn", "taskMid", "task"] as const;

const forLocale = localized((L: Locale, site) => {
  const { arcanumTitle } = localizedArcana(L);
  const { pairTail, pairTailKeys, karmicTail } = localizedContent(L);
  const { PAIR_TAIL_HUB, arcanumHref, pairTailHref, karmicTailHref } = localizedEncyclopedia(L);
  const { articleLd } = localizedSchema(L, site);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { pageMeta } = localizedSite(L, site);
  const { encyclopediaSectionCrumb } = localizedEncyclopediaNavigation(L);
  return { arcanumTitle, pairTail, pairTailKeys, karmicTail, PAIR_TAIL_HUB, arcanumHref, pairTailHref, karmicTailHref, articleLd, NOT_FOUND_META, pageMeta, encyclopediaSectionCrumb };
});

export function generateStaticParams(): Params[] {
  return forLocale(defaultLocale).pairTailKeys().map((triple) => ({ triple }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const L = await publicLocale();
  const { pairTail, pairTailHref, NOT_FOUND_META, pageMeta } = forLocale(L, await requestSite());
  const item = pairTail((await params).triple);
  if (!item) return NOT_FOUND_META;
  return pageMeta({
    title: item.seo.title,
    description: item.seo.description,
    path: pairTailHref(item.key),
    article: true,
    noindex: !item.publication.index,
    follow: item.publication.follow,
  });
}

export default async function PairTailPage({ params }: { params: Promise<Params> }) {
  const L = await requestLocale();
  const { arcanumTitle, pairTail, pairTailKeys, karmicTail, PAIR_TAIL_HUB, arcanumHref, pairTailHref, karmicTailHref, articleLd, encyclopediaSectionCrumb } = forLocale(L, await requestSite());
  const item = pairTail((await params).triple);
  if (!item) notFound();
  const arcana = item.key.split("-").map(Number);
  const sorted = (key: string) => key.split("-").map(Number).sort((x, y) => x - y).join("-");
  const siblings = pairTailKeys().filter((key) => key !== item.key && sorted(key) === sorted(item.key));
  const personal = karmicTail(item.key);

  return (
    <>
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("cmp"),
          { name: DP.encPairTail.crumb[L], path: PAIR_TAIL_HUB },
          { name: item.key },
        ]}
      />
      <JsonLd data={articleLd({ headline: item.seo.title, description: item.seo.description, path: pairTailHref(item.key), keywords: item.seo.queries })} />
      <h1>{item.title}</h1>
      <p className="dim prose">{item.short}</p>
      <div className="tail-deck section-gap" data-testid="pair-tail-deck">
        {arcana.map((n, i) => (
          <Link className="ecard tail-card" key={`${n}-${i}`} href={arcanumHref(n)}>
            <ArcanumCard locale={L} n={n} size="big" eager={i === 0} decorative />
            <div className="tail-card-label">
              <div className="num">{DP.role[ROLES[i]][L]} · {n}</div>
              <div className="nm">{arcanumTitle(n)}</div>
            </div>
          </Link>
        ))}
      </div>
      {item.intro.length ? <div className="section-gap"><Paragraphs items={item.intro} locale={L} /></div> : null}
      <Sections items={item.sections} locale={L} />

      <div className="allbox section-gap">
        <h3>{DP.encPairTail.calcTitle[L]}</h3>
        <p>{DP.encPairTail.calcLead[L]}</p>
        <Link className="btn" href="/compatibility">{DP.encCompat.calcButton[L]}</Link>
      </div>

      <Faq locale={L} items={item.faq} />

      <div className="panel section-gap">
        <h3>{DP.encPairTail.whereNext[L]}</h3>
        <div className="taglist">
          {siblings.map((key) => <Link key={key} href={pairTailHref(key)}>{DP.encPairTail.sibling[L](key)}</Link>)}
          {personal ? <Link href={karmicTailHref(item.key)}>{DP.encPairTail.personal[L](item.key)}</Link> : null}
          <Link href={PAIR_TAIL_HUB}>{DP.encPairTail.all[L]}</Link>
        </div>
      </div>
    </>
  );
}
