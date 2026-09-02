import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PersonalSectionArticle from "@/components/matrix/PersonalSectionArticle";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import { encyclopediaSectionCrumb } from "@/lib/encyclopediaNavigation";
import { positionHref } from "@/lib/publicSpec";
import { articleLd } from "@/lib/schema";
import type { PersonalSectionKey } from "@/lib/sectionReadingShared";
import { buildSectionReading, sectionReadingMatrix } from "@/lib/sectionReadings";
import { birthLabel } from "@/lib/matrix";
import { sectionByKey } from "@/lib/sections";
import { NOT_FOUND_META } from "@/lib/seo";
import { pageMeta } from "@/lib/site";

type Params = { slug: string };
type Search = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function data(key: PersonalSectionKey, params: Params, search: Search) {
  const query = { birth: one(search.birth) };
  const matrix = sectionReadingMatrix(key, params.slug, query);
  const section = sectionByKey(key);
  if (!matrix || !section) return null;
  const reading = buildSectionReading(key, matrix);
  const suffix = key === "years" && query.birth ? `?birth=${query.birth}` : "";
  const path = `/encyclopedia/${key}/${params.slug}${suffix}`;
  // Без параметра `birth` линия отдаётся без персонального возраста и `matrix.birth` пуст:
  // `birthLabel("")` давал «для даты undefined undefined 0» в трёх метатегах и в JSON-LD
  // на всех 5 544 адресах раздела.
  const subject = key === "years" && matrix.birth
    ? `результата ${params.slug} для даты ${birthLabel(matrix.birth)}`
    : `рассчитанного результата ${params.slug}`;
  const description = `${section.title}: персональный связный разбор ${subject}, ролей, переходов и практического шага.`;
  return { key, section, reading, path, description };
}

export function personalReadingMetadata(key: PersonalSectionKey) {
  return async function generateMetadata({
    params,
    searchParams,
  }: {
    params: Promise<Params>;
    searchParams: Promise<Search>;
  }): Promise<Metadata> {
    const value = data(key, await params, await searchParams);
    if (!value) return NOT_FOUND_META;
    return pageMeta({
      title: value.reading.title,
      description: value.description,
      path: value.path,
      article: true,
      noindex: true,
      follow: true,
    });
  };
}

export function personalReadingPage(key: PersonalSectionKey) {
  return async function PersonalReadingPage({
    params,
    searchParams,
  }: {
    params: Promise<Params>;
    searchParams: Promise<Search>;
  }) {
    const value = data(key, await params, await searchParams);
    if (!value) notFound();
    return (
      <>
        <CrumbsLd
          trail={[
            { name: "Главная", path: "/" },
            { name: "Энциклопедия", path: "/encyclopedia" },
            encyclopediaSectionCrumb("sec"),
            { name: value.section.title, path: positionHref(value.key) },
            { name: value.reading.slug },
          ]}
        />
        <JsonLd
          data={articleLd({
            headline: value.reading.title,
            description: value.description,
            path: value.path,
          })}
        />
        <PersonalSectionArticle
          sectionKey={value.key}
          sectionTitle={value.section.title}
          reading={value.reading}
        />
      </>
    );
  };
}
