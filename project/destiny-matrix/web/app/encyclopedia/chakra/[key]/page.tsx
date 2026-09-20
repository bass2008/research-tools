import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { D, L } from "@/lib/i18n";
import PositionMap from "@/components/enc/PositionMap";
import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import Price from "@/components/pay/Price";

import { ALL_FREE } from "@/lib/access";
import { ARCANA } from "@/lib/arcana";
import { CHAKRA_PAGES, arcanumHref, chakraByKey, chakraHref, positionHref } from "@/lib/encyclopedia";
import { chakraContent } from "@/lib/content";
import { mapPointsBySymbol } from "@/lib/matrixMap";
import { pageMeta } from "@/lib/site";
import { articleLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";
import { encyclopediaSectionCrumb } from "@/lib/encyclopediaNavigation";

type Params = { key: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return CHAKRA_PAGES.map((c) => ({ key: c.key }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const c = chakraByKey((await params).key);
  // Пустые метаданные оставляли на 404 заголовок главной: в истории браузера и в выдаче
  // несуществующая страница выглядела как главная.
  if (!c) return NOT_FOUND_META;
  const extra = chakraContent(c.key);
  if (!extra) throw new Error(`нет канонического материала чакры ${c.key}`);
  return pageMeta({
    title: extra.seo.title,
    description: extra.seo.description,
    path: chakraHref(c.key),
    article: true,
  });
}

export default async function ChakraPage({ params }: { params: Promise<Params> }) {
  const c = chakraByKey((await params).key);
  if (!c) notFound();
  const extra = chakraContent(c.key);
  if (!extra) throw new Error(`нет канонического материала чакры ${c.key}`);
  const paragraphs = extra.level;
  // Уровень — это горизонтальная пара точек карты, и «где находится свадхистана» спрашивают
  // ровно про место. Символы пары лежат в контракте метода.
  const spots = mapPointsBySymbol([c.physics, c.energy]);
  const title = extra.seo.title;

  return (
    <>

      <CrumbsLd
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("chk"),
          { name: c.title },
        ]}
      />
        <JsonLd
          data={articleLd({
            headline: title,
            description: extra.seo.description,
            path: chakraHref(c.key),
          })}
        />

        {/* Форма запроса, а не только имя: «чакра <имя> в матрице судьбы» — единственная
            формулировка со спросом у верхних трёх чакр, а «<имя> — уровень N» не спрашивает
            никто. Номер уровня остаётся, но после названия страницы. */}
        <h1>
          {D.encChakra.h1[L](c.title, c.index)}
        </h1>
        <p className="dim prose">{c.hint}</p>

        <PositionMap
          highlight={spots}
          caption={D.encChakra.caption[L](
            spots.map((x) => `${x.label} · ${x.symbol}`).join(` ${D.encArcanum.and[L]} `),
          )}
        />

        <div className="prose section-gap">
          {paragraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
          <h2>{D.encChakra.howCounted[L]}</h2>
          <p>
            {D.encChakra.howCountedText[L](c.title, c.physics, c.energy)}
          </p>
          <p>
            {D.encChakra.totalsText[L]}{" "}
            <Link href={positionHref("chakras")}>{D.encChakra.sectionChakras[L]}</Link>{" "}
            {D.encChakra.showsWholeTable[L]}{" "}
            <Link href={positionHref("body_resource")}>{D.encChakra.sectionBody[L]}</Link>{" "}
            {D.encChakra.coversLowest[L]}
          </p>
        </div>

        {extra.columns.length ? (
          <div className="panel section-gap">
            <h3>{D.encChakra.threeColumns[L]}</h3>
            <div className="cap">{D.encChakra.threeColumnsHint[L]}</div>
            <dl className="kv">
              {extra.columns.map((col) => (
                <div key={col.title} style={{ display: "contents" }}>
                  <dt>{col.title}</dt>
                  <dd>{col.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="section-gap">
          <CalcPromo
            title={D.encChakra.promoTitle[L]}
            lead={D.encChakra.promoLead[L](c.title)}
            place="chakra"
          />
        </div>

        <div className="panel section-gap">
          <h3>{D.encChakra.otherLevels[L]}</h3>
          <div className="cap">{D.encChakra.otherLevelsHint[L]}</div>
          <div className="taglist">
            {CHAKRA_PAGES.filter((o) => o.key !== c.key).map((o) => (
              <Link key={o.key} href={chakraHref(o.key)}>
                {o.index}. {o.title}
              </Link>
            ))}
          </div>
        </div>

        <div className="panel section-gap">
          <h3>{D.encChakra.whichArcanum[L]}</h3>
          <div className="cap">{D.encChakra.whichArcanumHint[L]}</div>
          <div className="taglist">
            {ARCANA.map((a) => (
              <Link key={a.n} href={arcanumHref(a.n)}>
                {a.n} · {a.title}
              </Link>
            ))}
          </div>
        </div>

        <div className="allbox">
          <h3>{D.encChakra.buildEnergyMap[L]}</h3>
          <p>
            {D.encChakra.buildEnergyMapText[L]}{" "}
            {ALL_FREE ? (
              <>{D.encChakra.fullMapOpen[L]}</>
            ) : (
              <>{D.encChakra.fullMapPaid[L]} <Price />.</>
            )}
          </p>
          <Link className="btn" href="/#calc">
            {D.matrixPages.calcMatrix[L]}
          </Link>
        </div>
    </>
  );
}
