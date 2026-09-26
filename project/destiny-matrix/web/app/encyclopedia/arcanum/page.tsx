import { requestSite } from "@/lib/siteProfile.server";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
import { ArcanaDeck } from "@/components/enc/lists";
import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedArcana } from "@/lib/arcana";
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
  const { categoryHub } = localizedContent(L);
  const { ARCANUM_HUB, arcanumHref } = localizedEncyclopedia(L);
  const { encyclopediaSection } = localizedEncyclopediaNavigation(L);
  const { articleLd, itemListLd } = localizedSchema(L, site);
  const { pageMeta } = localizedSite(L, site);
  const { ARCANA } = localizedArcana(L);

  const KEY = "arcanum";

  const HUB = categoryHub(KEY);

  if (!HUB) throw new Error(`нет канонического материала хаба ${KEY}`);

  const metadata: Metadata = pageMeta({
    title: HUB.seo.title,
    description: HUB.seo.description,
    path: ARCANUM_HUB,
    article: true,
  });
  return { categoryHub, ARCANUM_HUB, arcanumHref, encyclopediaSection, articleLd, itemListLd, pageMeta, ARCANA, KEY, HUB, metadata };
});

export default async function ArcanumHubPage() {
  const L = await requestLocale();
  const { ARCANUM_HUB, arcanumHref, encyclopediaSection, articleLd, itemListLd, ARCANA, HUB } = forLocale(L, await requestSite());

  const hub = HUB!;

  return (
    <>
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          { name: encyclopediaSection("arc").title },
        ]}
      />
      <JsonLd
        data={articleLd({ headline: hub.seo.title, description: hub.seo.description, path: ARCANUM_HUB })}
      />
      <JsonLd
        data={itemListLd({
          name: encyclopediaSection("arc").title,
          items: ARCANA.map((a) => ({ name: `${a.n} · ${a.title}`, path: arcanumHref(a.n) })),
        })}
      />

      <h1>{hub.title}</h1>
      <p className="dim prose">{hub.short}</p>

      <div className="panel section-gap">
        <h2>{D.enc.allArcana[L]}</h2>
        <div className="cap">{encyclopediaSection("arc").hint} · {ARCANA.length}</div>
        <ArcanaDeck locale={L} />
      </div>

      <Sections items={hub.sections} />

      <div className="section-gap">
        <CalcPromo locale={L}
          title={D.enc.promoArcanaTitle[L]}
          lead={D.enc.promoArcanaLead[L]}
          place="arcanum-hub"
        />
      </div>

      <Faq locale={L} items={hub.faq} />

      <Related locale={L} path={ARCANUM_HUB} refs={hub.related} />
    </>
  );
}
export async function generateMetadata() {
  return forLocale(await publicLocale(), await requestSite()).metadata;
}
