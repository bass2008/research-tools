import { requestSite } from "@/lib/siteProfile.server";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
import TailSearch from "@/components/enc/TailSearch";
import CalcPromo from "@/components/matrix/CalcPromo";
import { PriceOrFree } from "@/components/pay/Price";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { karmicTailNumberIndex } from "@/lib/karmicTailIndex";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

const forLocale = localized((L: Locale, site) => {
  const { arcanumTitle } = localizedArcana(L);
  const { categoryHub, karmicTails } = localizedContent(L);
  const { KARMIC_TAIL_HUB, arcanumHref, karmicTailHref, parseTail } = localizedEncyclopedia(L);
  const { articleLd, itemListLd } = localizedSchema(L, site);
  const { pageMeta } = localizedSite(L, site);
  const { encyclopediaSection } = localizedEncyclopediaNavigation(L);

  const KEY = "karmic-tail";

  const HUB = categoryHub(KEY);

  if (!HUB) throw new Error(`нет канонического материала хаба ${KEY}`);

  const metadata: Metadata = pageMeta({
    title: HUB.seo.title,
    description: HUB.seo.description,
    path: KARMIC_TAIL_HUB,
    article: true,
  });

  /** Тройки по числам, а не по строке: localeCompare ставил 11-11-4 после 11-11-22. */
  function byTriple(a: string, b: string): number {
    const x = a.split("-").map(Number);
    const y = b.split("-").map(Number);
    for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
    return 0;
  }
  return { arcanumTitle, categoryHub, karmicTails, KARMIC_TAIL_HUB, arcanumHref, karmicTailHref, parseTail, articleLd, itemListLd, pageMeta, encyclopediaSection, KEY, HUB, metadata, byTriple };
});

export default async function KarmicTailHubPage() {
  const L = await requestLocale();
  const { arcanumTitle, karmicTails, KARMIC_TAIL_HUB, arcanumHref, karmicTailHref, parseTail, articleLd, itemListLd, encyclopediaSection, HUB, byTriple } = forLocale(L, await requestSite());

  const hub = HUB!;
  const items = karmicTails().filter((item) => item.publication.index).sort((a, b) => byTriple(a.key, b.key));
  const numberIndex = karmicTailNumberIndex(items.map((item) => item.key));
  const placeNames = { M: D.enc.tailPlaceM[L], N: D.enc.tailPlaceN[L], D: D.enc.tailPlaceD[L] };

  return (
    <>

      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          { name: encyclopediaSection("tls").title },
        ]}
      />
      <JsonLd
        data={articleLd({
          headline: hub.seo.title,
          description: hub.seo.description,
          path: KARMIC_TAIL_HUB,
        })}
      />
      {items.length ? (
        <JsonLd
          data={itemListLd({
            name: encyclopediaSection("tls").title,
            items: items.map((t) => ({ name: t.key, path: karmicTailHref(t.key) })),
          })}
        />
      ) : null}

      <h1>{hub.title}</h1>
      <p className="dim prose">{hub.short}</p>

      <div className="panel section-gap">
        <TailSearch locale={L} tails={items.map((t) => ({ key: t.key, href: karmicTailHref(t.key),
          names: (parseTail(t.key) ?? t.arcana).map((n) => arcanumTitle(n)).join(" · ") }))} />
      </div>

      <Sections items={hub.sections.slice(1)} locale={L} start={1} />

      <div className="section-gap">
        <CalcPromo locale={L}
          title={D.enc.promoTailTitle[L]}
          lead={D.enc.promoTailLead[L]}
          place="karmic-tail-hub"
        />
      </div>

      <Faq locale={L} items={hub.faq} />

      <div className="panel section-gap">
        <Sections items={hub.sections.slice(0, 1)} locale={L} />
        {numberIndex.map(({ arcanum, tails }) => (
          <div className="section-gap" key={arcanum}>
            <h3>{arcanum} · {arcanumTitle(arcanum)}</h3>
            <div className="taglist">
              {tails.map(({ key, places }) => (
                <Link key={key} href={karmicTailHref(key)} prefetch={false}>
                  {key} · {places.map((place) => placeNames[place]).join(", ")}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Related locale={L} path={KARMIC_TAIL_HUB} refs={hub.related} />

      <div className="panel section-gap">
        <h3>{D.enc.tailArcana[L]}</h3>
        <div className="cap">{D.enc.tailArcanaHint[L]}</div>
        <div className="taglist">
          {Array.from({ length: 22 }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={arcanumHref(n)}>
              {n} · {arcanumTitle(n)}
            </Link>
          ))}
        </div>
      </div>

      <div className="allbox">
        <h3>{D.enc.buildYourChart[L]}</h3>
        <p>
          {D.enc.tailBuildText[L]} <PriceOrFree locale={L} />.
        </p>
        <Link className="btn" href="/#calc">
          {D.matrixPages.calcFree[L]}
        </Link>
      </div>
    </>
  );
}
export async function generateMetadata() {
  return forLocale(await publicLocale(), await requestSite()).metadata;
}
