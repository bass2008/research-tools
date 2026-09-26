import PersonalSectionArticle from "@/components/matrix/PersonalSectionArticle";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedMatrix } from "@/lib/matrix";
import { forLocale as localizedPublicSpec } from "@/lib/publicSpec";
import { forLocale as localizedSchema } from "@/lib/schema";
import type { PersonalSectionKey } from "@/lib/sectionReadingShared";
import { forLocale as localizedSectionReadings } from "@/lib/sectionReadings";
import { forLocale as localizedSections } from "@/lib/sections";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Params = { slug: string };

type Search = Record<string, string | string[] | undefined>;

export const forLocale = localized((L: Locale, site) => {
  const { encyclopediaSectionCrumb } = localizedEncyclopediaNavigation(L);
  const { positionHref } = localizedPublicSpec(L);
  const { articleLd } = localizedSchema(L, site);
  const { buildSectionReading, sectionReadingMatrix } = localizedSectionReadings(L);
  const { birthLabel } = localizedMatrix(L);
  const { sectionByKey } = localizedSections(L);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { pageMeta } = localizedSite(L, site);

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
      ? D.encCharacter.subjectWithDate[L](params.slug, birthLabel(matrix.birth))
      : D.encCharacter.subjectPlain[L](params.slug);
    const description = D.encCharacter.personalDescription[L](section.title, subject);
    return { key, section, reading, path, description };
  }

  function personalReadingMetadata(key: PersonalSectionKey) {
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

  function personalReadingPage(key: PersonalSectionKey) {
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
          <CrumbsLd locale={L}
            trail={[
              { name: D.nav.home[L], path: "/" },
              { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
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
          <PersonalSectionArticle locale={L}
            sectionKey={value.key}
            sectionTitle={value.section.title}
            reading={value.reading}
          />
        </>
      );
    };
  }
  return { encyclopediaSectionCrumb, positionHref, articleLd, buildSectionReading, sectionReadingMatrix, birthLabel, sectionByKey, NOT_FOUND_META, pageMeta, one, data, personalReadingMetadata, personalReadingPage };
});

export const { personalReadingMetadata, personalReadingPage } = forLocale(defaultLocale);
