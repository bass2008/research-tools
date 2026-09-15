import type { Metadata } from "next";
import Link from "next/link";

import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import PositionMap from "@/components/enc/PositionMap";
import Sections from "@/components/enc/Sections";

import { arcanumTitle } from "@/lib/arcana";
import { arcanumHref, positionByKey } from "@/lib/encyclopedia";
import {
  buildPositionArcanum,
  positionArcanumHref,
  positionArcanumLabel,
  positionArcanumSiblings,
  registryItem,
  registryItems,
} from "@/lib/positionArcanum";
import { encyclopediaSectionCrumb } from "@/lib/encyclopediaNavigation";
import { articleLd, faqLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";
import { mapPointsFor } from "@/lib/matrixMap";
import { pageMeta } from "@/lib/site";
import { clip } from "@/lib/text";

type Params = { key: string; n: string };

// Набор адресов конечен и задан реестром: какие пересечения бывают, решает метод, а спрос
// решает только, видит ли их поиск. Плоские 22 × 38 адресов были бы тем тонким корпусом,
// который уже дал 76 страниц хвостов на один показ за шесть дней.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return registryItems().map((item) => ({ key: item.position, n: String(item.arcanum) }));
}

function data(params: Params) {
  const arcanum = Number(params.n);
  if (!Number.isInteger(arcanum)) return null;
  if (!registryItem(params.key, arcanum)) return null;
  return buildPositionArcanum(params.key, arcanum);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolved = await params;
  const reading = data(resolved);
  if (!reading) return NOT_FOUND_META;
  const item = registryItem(reading.position, reading.arcanum);
  return pageMeta({
    title: reading.seo.title,
    description: reading.seo.description,
    path: positionArcanumHref(reading.position, reading.arcanum),
    article: true,
    noindex: !item?.publication.index,
    follow: item?.publication.follow ?? true,
  });
}

export default async function PositionArcanumPage({ params }: { params: Promise<Params> }) {
  const reading = data(await params);
  if (!reading) return null;
  const place = positionByKey(reading.position);
  const path = positionArcanumHref(reading.position, reading.arcanum);
  const siblings = positionArcanumSiblings(reading.position, reading.arcanum);
  // У пересечения та же схема, что у обзора позиции: вопрос «где это в карте» одинаков.
  const spots = mapPointsFor(reading.mapKeys);

  return (
    <>
      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          encyclopediaSectionCrumb(place?.kind === "section" ? "sec" : "pts"),
          { name: reading.positionTitle, path: reading.positionHref },
          { name: reading.title },
        ]}
      />
      <JsonLd
        data={articleLd({ headline: reading.seo.title, description: reading.seo.description, path })}
      />
      {reading.faq.length ? <JsonLd data={faqLd(reading.faq)} /> : null}

      <h1>{reading.title}</h1>
      <p className="dim prose">{reading.short}</p>

      <PositionMap
        highlight={spots}
        caption={spots.length === 1
          ? `Где стоит эта точка: ${spots[0]!.label} · ${spots[0]!.symbol}`
          : `Где стоят точки раздела: ${spots.map((x) => `${x.label} · ${x.symbol}`).join(", ")}`}
      />

      <Sections items={reading.sections} />

      {reading.tails.length ? (
        <div className="panel section-gap">
          <h2>Тройки с этим арканом</h2>
          <div className="cap">
            {reading.tails.length} хвостов с разбором, где стоит аркан {reading.arcanum}
          </div>
          <div className="cardgrid">
            {reading.tails.map((tail) => (
              <Link className="ecard" key={tail.key} href={tail.href} prefetch={false}>
                <div className="num">{tail.key}</div>
                <div className="ds">{clip(tail.short, 120)}</div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="section-gap">
        <CalcPromo
          title="Узнать свой аркан на этой позиции"
          lead="Карта по дате рождения строится бесплатно и без регистрации: после расчёта видно, какой аркан стоит у вас именно здесь."
          place="position-arcanum"
        />
      </div>

      <Faq items={reading.faq} />

      <div className="panel section-gap">
        <h3>Рядом</h3>
        <div className="cap">Та же энергия в других ролях и сама позиция</div>
        <div className="taglist">
          <Link href={reading.positionHref}>{reading.positionTitle}</Link>
          <Link href={arcanumHref(reading.arcanum)}>
            {reading.arcanum} · {arcanumTitle(reading.arcanum)}
          </Link>
          {siblings.map((sib) => (
            <Link
              key={`${sib.position}-${sib.arcanum}`}
              href={positionArcanumHref(sib.position, sib.arcanum)}
              prefetch={false}
            >
              {positionArcanumLabel(sib)}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
