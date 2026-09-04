import type { Metadata } from "next";

import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
import { ArcanaDeck } from "@/components/enc/lists";

import { categoryHub } from "@/lib/content";
import { ARCANUM_HUB, arcanumHref } from "@/lib/encyclopedia";
import { encyclopediaSection } from "@/lib/encyclopediaNavigation";
import { articleLd, itemListLd } from "@/lib/schema";
import { pageMeta } from "@/lib/site";
import { ARCANA } from "@/lib/arcana";

const KEY = "arcanum";

const HUB = categoryHub(KEY);
if (!HUB) throw new Error(`нет канонического материала хаба ${KEY}`);

export const metadata: Metadata = pageMeta({
  title: HUB.seo.title,
  description: HUB.seo.description,
  path: ARCANUM_HUB,
  article: true,
});

export default function ArcanumHubPage() {
  const hub = HUB!;

  return (
    <>
      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
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

      <Sections items={hub.sections} />

      <div className="section-gap">
        <CalcPromo
          title="Узнать свои арканы"
          lead="Карта по дате рождения строится бесплатно и без регистрации: после расчёта каждое число становится ссылкой на своё значение."
          place="arcanum-hub"
        />
      </div>

      <div className="panel section-gap">
        <h2>Все 22 аркана</h2>
        <div className="cap">{encyclopediaSection("arc").hint} · {ARCANA.length}</div>
        <ArcanaDeck />
      </div>


      <Faq items={hub.faq} />

      <Related path={ARCANUM_HUB} refs={hub.related} />
    </>
  );
}
