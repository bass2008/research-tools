import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CharacterReadingView from "@/components/matrix/CharacterReadingView";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import { buildCharacterReading } from "@/lib/character";
import { matrixItem } from "@/lib/content";
import { encyclopediaSectionCrumb } from "@/lib/encyclopediaNavigation";
import { positionHref } from "@/lib/publicSpec";
import { articleLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";
import { pageMeta } from "@/lib/site";

type Params = { triple: string };

// 5 544 персональных статей собираются на запрос и закрыты от индексации. Они живут в
// энциклопедии как толкования, а не в /matrix, который оставлен результату калькулятора.
export const dynamic = "force-dynamic";

function data(triple: string) {
  const item = matrixItem(triple);
  if (!item) return null;
  const reading = buildCharacterReading(item.matrix);
  const path = `/encyclopedia/character/${triple}`;
  const description =
    `Персональный разбор характера для матрицы ${triple}: портрет личности, духовная и ` +
    `материальная задачи, связи трёх арканов, сильная сторона и практический шаг.`;
  return { item, reading, path, description };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const value = data((await params).triple);
  if (!value) return NOT_FOUND_META;
  return pageMeta({
    title: value.reading.title,
    description: value.description,
    path: value.path,
    article: true,
    noindex: true,
    follow: true,
  });
}

export default async function CharacterPage({ params }: { params: Promise<Params> }) {
  const value = data((await params).triple);
  if (!value) notFound();
  const { item, reading, path, description } = value;

  return (
    <>
      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          encyclopediaSectionCrumb("sec"),
          { name: "Характер и личные качества", path: positionHref("character") },
          { name: item.slug },
        ]}
      />
      <JsonLd data={articleLd({ headline: reading.title, description, path })} />

      <p className="eyebrow">Персональный раздел матрицы {item.slug}</p>
      <h1>{reading.title}</h1>
      <p className="dim prose">{reading.lead}</p>

      <CharacterReadingView reading={reading} />

      <div className="allbox">
        <h2>Что означают точки A, B и C</h2>
        <p>
          Общая статья объясняет метод чтения раздела, а эта страница применяет его к вашей
          тройке {item.slug}.
        </p>
        <div className="btnrow center">
          <Link className="btn" href={positionHref("character")}>
            Открыть статью о разделе
          </Link>
          <Link className="btn ghost" href={`/matrix/${item.slug}`}>
            Вернуться к матрице
          </Link>
          <Link className="btn ghost" href="/#calc">
            Рассчитать другую дату
          </Link>
        </div>
      </div>
    </>
  );
}
