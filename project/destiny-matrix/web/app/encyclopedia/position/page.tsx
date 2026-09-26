import { requestSite } from "@/lib/siteProfile.server";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
import { forLocale as localizedLists, PositionRows } from "@/components/enc/lists";
import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";

const forLocale = localized((L: Locale, site) => {
  const { positionsOfKind } = localizedLists(L);
  const { categoryHub } = localizedContent(L);
  const { POSITION_HUB, POSITIONS, positionHref } = localizedEncyclopedia(L);
  const { encyclopediaSection } = localizedEncyclopediaNavigation(L);
  const { articleLd, itemListLd } = localizedSchema(L, site);
  const { pageMeta } = localizedSite(L, site);

  const KEY = "position";

  const HUB = categoryHub(KEY);

  if (!HUB) throw new Error(`нет канонического материала хаба ${KEY}`);

  const metadata: Metadata = pageMeta({
    title: HUB.seo.title,
    description: HUB.seo.description,
    path: POSITION_HUB,
    article: true,
  });
  return { positionsOfKind, categoryHub, POSITION_HUB, POSITIONS, positionHref, encyclopediaSection, articleLd, itemListLd, pageMeta, KEY, HUB, metadata };
});

export default async function PositionHubPage() {
  const L = await requestLocale();
  const { positionsOfKind, POSITION_HUB, POSITIONS, positionHref, encyclopediaSection, articleLd, itemListLd, HUB } = forLocale(L, await requestSite());

  const hub = HUB!;
  const sections = positionsOfKind("section");
  const points = positionsOfKind("point");

  return (
    <>
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          { name: encyclopediaSection("pts").title },
        ]}
      />
      <JsonLd
        data={articleLd({ headline: hub.seo.title, description: hub.seo.description, path: POSITION_HUB })}
      />
      <JsonLd
        data={itemListLd({
          name: encyclopediaSection("pts").title,
          items: POSITIONS.map((p) => ({ name: p.title, path: positionHref(p.key) })),
        })}
      />

      <h1>{hub.title}</h1>
      <p className="dim prose">{hub.short}</p>

      <div className="panel section-gap" id="tochki">
        <h2>{encyclopediaSection("pts").title}</h2>
        <div className="cap">{encyclopediaSection("pts").hint} · {points.length}</div>
        <PositionRows locale={L} items={points} />
      </div>
      <div className="panel section-gap" id="razdely">
        <h2>{encyclopediaSection("sec").title}</h2>
        <div className="cap">{encyclopediaSection("sec").hint} · {sections.length}</div>
        <PositionRows locale={L} items={sections} />
      </div>

      <Sections items={hub.sections} />

      <div className="section-gap">
        <CalcPromo locale={L}
          title={D.enc.promoPositionTitle[L]}
          lead={D.enc.promoPositionLead[L]}
          place="position-hub"
        />
      </div>

      <Faq locale={L} items={hub.faq} />

      <Related locale={L} path={POSITION_HUB} refs={hub.related} />
    </>
  );
}
export async function generateMetadata() {
  return forLocale(await publicLocale(), await requestSite()).metadata;
}
