import type { Metadata } from "next";

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
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          { name: encyclopediaSection("cmb").title },
        ]}
      />
      <JsonLd
        data={articleLd({ headline: hub.seo.title, description: hub.seo.description, path: COMBINATION_HUB })}
      />

      <h1>{hub.title}</h1>
      <p className="dim prose">{hub.short}</p>

      <Sections items={hub.sections} />

      <div className="section-gap">
        <CalcPromo
          title="Узнать свой аркан отношений"
          lead="Карта по дате рождения строится бесплатно. Пара складывается из арканов отношений двоих, поэтому нужны две даты."
          place="combination-hub"
        />
      </div>

      <div className="panel section-gap">
        <h2>Все сочетания</h2>
        <div className="cap">
          {encyclopediaSection("cmb").hint} · {pairs.length}. Выберите свой аркан отношений в строке и
          аркан партнёра в столбце — порядок значения не имеет.
        </div>
        <CombinationMatrix />
      </div>


      <Faq items={hub.faq} />

      <Related path={COMBINATION_HUB} refs={hub.related} />
    </>
  );
}
