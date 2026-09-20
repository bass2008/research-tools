import { D, L } from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";

import { hubCrumb, hubHref } from "@/lib/encyclopedia";
import { hub, hubKeys } from "@/lib/content";
import { articleLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";
import { pageMeta } from "@/lib/site";
import { encyclopediaSectionCrumb } from "@/lib/encyclopediaNavigation";

import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import Price, { PriceOrFree } from "@/components/pay/Price";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";

import type { ArticleContent } from "@/lib/content";

// Концепт-хаб — посадочная под именованное понятие («программы», «кармическая матрица»,
// «энергии»). Разметка у всех одна, различается только текст, поэтому роут остаётся
// трёхстрочным, а вёрстка живёт здесь.
/** Метаданные статьи-хаба: у пяти страниц они собираются из одной записи `hubs.json`. */
export function hubMeta(key: string): Metadata {
  const item = hub(key);
  if (!item) return NOT_FOUND_META;
  return pageMeta({
    title: item.seo.title,
    description: item.seo.description,
    path: hubHref(key),
    article: true,
  });
}

export default function HubArticle({ item }: { item: ArticleContent }) {
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

      <CrumbsLd
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
        <CalcPromo
          title={D.octagram.hubPromoTitle[L]}
          lead={D.octagram.hubPromoLead[L]}
          place={`hub-${item.key}`}
        />
      </div>

      <Faq items={item.faq} />

      <Related path={path} refs={item.related} />

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
          {D.octagram.calcFreeLead[L]} {D.octagram.fullReadingAll[L]} <PriceOrFree />.
        </p>
        <Link className="btn" href="/#calc">
          {D.matrixPages.calcFree[L]}
        </Link>
      </div>
    </>
  );
}
