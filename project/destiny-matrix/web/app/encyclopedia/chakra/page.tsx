import type { Metadata } from "next";

import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
import { ChakraList } from "@/components/enc/lists";

import { categoryHub } from "@/lib/content";
import { CHAKRA_HUB, CHAKRA_PAGES, chakraHref } from "@/lib/encyclopedia";
import { encyclopediaSection } from "@/lib/encyclopediaNavigation";
import { articleLd, itemListLd } from "@/lib/schema";
import { pageMeta } from "@/lib/site";

const KEY = "chakra";

const HUB = categoryHub(KEY);
if (!HUB) throw new Error(`нет канонического материала хаба ${KEY}`);

export const metadata: Metadata = pageMeta({
  title: HUB.seo.title,
  description: HUB.seo.description,
  path: CHAKRA_HUB,
  article: true,
});

export default function ChakraHubPage() {
  const hub = HUB!;

  return (
    <>
      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          { name: encyclopediaSection("chk").title },
        ]}
      />
      <JsonLd
        data={articleLd({ headline: hub.seo.title, description: hub.seo.description, path: CHAKRA_HUB })}
      />
      <JsonLd
        data={itemListLd({
          name: encyclopediaSection("chk").title,
          items: CHAKRA_PAGES.map((c) => ({ name: c.title, path: chakraHref(c.key) })),
        })}
      />


      <h1>{hub.title}</h1>
      <p className="dim prose">{hub.short}</p>

      <Sections items={hub.sections} />

      <div className="section-gap">
        <CalcPromo
          title="Построить свою карту энергий"
          lead="Чакровая таблица считается вместе с картой по дате рождения — бесплатно и без регистрации."
          place="chakra-hub"
        />
      </div>

      <div className="panel section-gap">
        <h2>Семь уровней</h2>
        <div className="cap">{encyclopediaSection("chk").hint} · {CHAKRA_PAGES.length}</div>
        <ChakraList />
      </div>


      <Faq items={hub.faq} />

      <Related path={CHAKRA_HUB} refs={hub.related} />
    </>
  );
}
