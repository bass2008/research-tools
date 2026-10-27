import { requestSite } from "@/lib/siteProfile.server";
import TailSearch from "@/components/enc/TailSearch";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
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
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const forLocale = localized((L: Locale, site) => {
  const { arcanumTitle } = localizedArcana(L);
  const { categoryHub, pairTail, pairTailKeys } = localizedContent(L);
  const { PAIR_TAIL_HUB, pairTailHref } = localizedEncyclopedia(L);
  const { articleLd, itemListLd } = localizedSchema(L, site);
  const { pageMeta } = localizedSite(L, site);
  const { encyclopediaSectionCrumb } = localizedEncyclopediaNavigation(L);
  const KEY = "compatibility-tails";
  return { KEY, categoryHub, arcanumTitle, pairTail, pairTailKeys, PAIR_TAIL_HUB, pairTailHref, articleLd, itemListLd, pageMeta, encyclopediaSectionCrumb };
});

export async function generateMetadata(): Promise<Metadata> {
  const L = await publicLocale();
  const { KEY, categoryHub, PAIR_TAIL_HUB, pageMeta } = forLocale(L, await requestSite());
  const hub = categoryHub(KEY);
  if (!hub) return {};
  return pageMeta({ title: hub.seo.title, description: hub.seo.description, path: PAIR_TAIL_HUB, article: true });
}

export default async function PairTailHubPage() {
  const L = await requestLocale();
  const { KEY, categoryHub, arcanumTitle, pairTail, pairTailKeys, PAIR_TAIL_HUB, pairTailHref, articleLd, itemListLd, encyclopediaSectionCrumb } = forLocale(L, await requestSite());

  const nums = (key: string) => key.split("-").map(Number);
  const names = (key: string) => nums(key).map((n) => arcanumTitle(n)).join(" · ");
  const items = pairTailKeys()
    .map((key) => pairTail(key)!)
    .filter((item) => item.publication.index)
    .sort((a, b) => {
      const [x, y] = [nums(a.key), nums(b.key)];
      return x[2] - y[2] || x[0] - y[0] || x[1] - y[1];
    });
  const groups = new Map<number, typeof items>();
  for (const item of items) {
    const d = nums(item.key)[2];
    groups.set(d, [...(groups.get(d) ?? []), item]);
  }
  const order = [...groups.keys()];
  const hub = categoryHub(KEY);
  if (!items.length || !hub) notFound();

  return (
    <>
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("cmp"),
          { name: DP.encPairTail.crumb[L] },
        ]}
      />
      <JsonLd data={articleLd({ headline: hub.seo.title, description: hub.seo.description, path: PAIR_TAIL_HUB, keywords: hub.seo.queries })} />
      {items.length ? (
        <JsonLd data={itemListLd({ name: DP.encPairTail.crumb[L], items: items.map((t) => ({ name: t.key, path: pairTailHref(t.key) })) })} />
      ) : null}

      <h1>{hub.title}</h1>
      <p className="dim prose">{hub.short}</p>

      <div className="panel section-gap">
        <TailSearch locale={L} pair tails={items.map((t) => ({ key: t.key, href: pairTailHref(t.key), names: names(t.key) }))} />
      </div>

      <Sections items={hub.sections} locale={L} />

      <div className="allbox section-gap">
        <h3>{DP.encPairTail.calcTitle[L]}</h3>
        <p>{DP.encPairTail.calcLead[L]}</p>
        <Link className="btn" href="/compatibility">{DP.encCompat.calcButton[L]}</Link>
      </div>

      <Faq locale={L} items={hub.faq} />

      <div className="panel section-gap" data-testid="pair-tail-catalog">
        <h2>{DP.encPairTail.listTitle[L]}</h2>
        <div className="cap">{DP.encPairTail.listHint[L](items.length)}</div>
        {order.map((d) => (
          <div className="section-gap" key={d}>
            <h3>{DP.encPairTail.groupTitle[L](d, arcanumTitle(d))}</h3>
            <div className="taglist">
              {groups.get(d)!.map((t) => (
                <Link key={t.key} href={pairTailHref(t.key)} title={names(t.key)} prefetch={false}>{t.key}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Related locale={L} path={PAIR_TAIL_HUB} refs={hub.related} />

      <div className="panel section-gap">
        <div className="taglist">
          <Link href="/encyclopedia/compatibility">{DP.encCompat.all[L]}</Link>
          <Link href="/encyclopedia/karmic-tail">{D.octagram.karmicTail[L]}</Link>
        </div>
      </div>
    </>
  );
}
