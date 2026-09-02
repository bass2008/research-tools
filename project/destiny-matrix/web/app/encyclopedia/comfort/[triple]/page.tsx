import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PersonalSectionArticle from "@/components/matrix/PersonalSectionArticle";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import { encyclopediaSectionCrumb } from "@/lib/encyclopediaNavigation";
import { positionHref } from "@/lib/publicSpec";
import { articleLd } from "@/lib/schema";
import {
  buildSectionReading,
  sectionReadingItem,
  sectionReadingSlugs,
} from "@/lib/sectionReadings";
import { NOT_FOUND_META } from "@/lib/seo";
import { pageMeta } from "@/lib/site";

type Params = { triple: string };

// Набор из 286 адресов конечен: неизвестный ключ получает штатный 404. Страницы остаются
// noindex/follow и не входят в sitemap независимо от способа рендера.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return sectionReadingSlugs("comfort").map((triple) => ({ triple }));
}

function data(triple: string) {
  const item = sectionReadingItem("comfort", triple);
  if (!item) return null;
  const reading = buildSectionReading("comfort", item.matrix);
  const path = `/encyclopedia/comfort/${triple}`;
  const description =
    `Персональный разбор внутренних точек ${triple}: базовое состояние E, ` +
    `автоматическая реакция M, возвращающий талант K, связи и практический шаг.`;
  return { reading, path, description };
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

export default async function ComfortReadingPage({ params }: { params: Promise<Params> }) {
  const value = data((await params).triple);
  if (!value) notFound();
  const { reading, path, description } = value;
  return (
    <>
      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          encyclopediaSectionCrumb("sec"),
          { name: "Центр и внутренние точки", path: positionHref("comfort") },
          { name: reading.slug },
        ]}
      />
      <JsonLd data={articleLd({ headline: reading.title, description, path })} />
      <PersonalSectionArticle
        sectionKey="comfort"
        sectionTitle="Центр и внутренние точки"
        reading={reading}
      />
    </>
  );
}
