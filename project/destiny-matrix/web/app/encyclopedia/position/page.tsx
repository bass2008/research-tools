import type { Metadata } from "next";

import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
import { PositionRows, positionsOfKind } from "@/components/enc/lists";

import { categoryHub } from "@/lib/content";
import { POSITION_HUB, POSITIONS, positionHref } from "@/lib/encyclopedia";
import { encyclopediaSection } from "@/lib/encyclopediaNavigation";
import { articleLd, itemListLd } from "@/lib/schema";
import { pageMeta } from "@/lib/site";

const KEY = "position";

const HUB = categoryHub(KEY);
if (!HUB) throw new Error(`нет канонического материала хаба ${KEY}`);

export const metadata: Metadata = pageMeta({
  title: HUB.seo.title,
  description: HUB.seo.description,
  path: POSITION_HUB,
  article: true,
});

export default function PositionHubPage() {
  const hub = HUB!;
  const sections = positionsOfKind("section");
  const points = positionsOfKind("point");

  return (
    <>
      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
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

      <Sections items={hub.sections} />

      <div className="section-gap">
        <CalcPromo
          title="Построить свою карту"
          lead="Карта по дате рождения строится бесплатно: после расчёта каждая точка станет ссылкой на свою позицию с уже подставленным арканом."
          place="position-hub"
        />
      </div>

      <div className="panel section-gap" id="tochki">
        <h2>{encyclopediaSection("pts").title}</h2>
        <div className="cap">{encyclopediaSection("pts").hint} · {points.length}</div>
        <PositionRows items={points} />
      </div>

      <div className="panel section-gap" id="razdely">
        <h2>{encyclopediaSection("sec").title}</h2>
        <div className="cap">{encyclopediaSection("sec").hint} · {sections.length}</div>
        <PositionRows items={sections} />
      </div>


      <Faq items={hub.faq} />

      <Related path={POSITION_HUB} refs={hub.related} />
    </>
  );
}
