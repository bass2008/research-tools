import type { Metadata } from "next";

import { D, L } from "@/lib/i18n";
import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
import { CombinationMatrix } from "@/components/enc/lists";

import { categoryHub } from "@/lib/content";
import { COMBINATION_HUB, allCombinationSlugs } from "@/lib/encyclopedia";
import { encyclopediaSection } from "@/lib/encyclopediaNavigation";
import { articleLd, itemListLd } from "@/lib/schema";
import { pageMeta } from "@/lib/site";

const KEY = "combination";

const HUB = categoryHub(KEY);
if (!HUB) throw new Error(`нет канонического материала хаба ${KEY}`);

export const metadata: Metadata = pageMeta({
  title: HUB.seo.title,
  description: HUB.seo.description,
  path: COMBINATION_HUB,
  article: true,
});

export default function CombinationHubPage() {
  const hub = HUB!;
  const pairs = allCombinationSlugs();

  return (
    <>
      <CrumbsLd
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          { name: encyclopediaSection("cmb").title },
        ]}
      />
      <JsonLd
        data={articleLd({ headline: hub.seo.title, description: hub.seo.description, path: COMBINATION_HUB })}
      />

      <h1>{hub.title}</h1>
      <p className="dim prose">{hub.short}</p>

      <div className="panel section-gap">
        <h2>{D.enc.allCombinations[L]}</h2>
        <div className="cap">
          {encyclopediaSection("cmb").hint} · {pairs.length}. {D.enc.combinationsLead[L]}
        </div>
        <CombinationMatrix />
      </div>

      <Sections items={hub.sections} />

      <div className="section-gap">
        <CalcPromo
          title={D.enc.promoCombinationTitle[L]}
          lead={D.enc.promoCombinationLead[L]}
          place="combination-hub"
        />
      </div>

      <Faq items={hub.faq} />

      <Related path={COMBINATION_HUB} refs={hub.related} />
    </>
  );
}
