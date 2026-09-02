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

// Всего 160 достижимых B–P–K: неизвестный ключ получает штатный 404, а сами страницы
// остаются noindex/follow и вне sitemap.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return sectionReadingSlugs("profession").map((triple) => ({ triple }));
}

function data(triple: string) {
  const item = sectionReadingItem("profession", triple);
  if (!item) return null;
  const reading = buildSectionReading("profession", item.matrix);
  const path = `/encyclopedia/profession/${triple}`;
  const description =
    `Персональный разбор линии таланта ${triple}: исходный дар B, форма работы P, ` +
    `внутренний результат K, связи и практический шаг.`;
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

export default async function ProfessionReadingPage({ params }: { params: Promise<Params> }) {
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
          { name: "Профессия и дело по душе", path: positionHref("profession") },
          { name: reading.slug },
        ]}
      />
      <JsonLd data={articleLd({ headline: reading.title, description, path })} />
      <PersonalSectionArticle
        sectionKey="profession"
        sectionTitle="Профессия и дело по душе"
        reading={reading}
      />
    </>
  );
}
