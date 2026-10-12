"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import { useEffect, useState } from "react";
import type { Lang } from "./i18n/lang";
import type { Matrix } from "./matrix";
import type { SectionOut } from "./publicSpec";

/**
 * Что внутри закрытых разделов: карты позиций и раскладка чакр с заглушкой вместо толкования.
 * Подписи платных позиций в клиентский чанк не кладутся, поэтому браузер берёт их у сервера по
 * слагу карты, как и полный разбор в `useFullSections`.
 */
export function useLockedPreview(matrix: Matrix | null, enabled: boolean): SectionOut[] | null {
  const L = useLocale();
  const slug = matrix ? `${matrix.day}-${matrix.month}-${matrix.year}` : "";
  const [loaded, setLoaded] = useState<{ slug: string; locale: Lang; sections: SectionOut[] } | null>(null);

  useEffect(() => {
    if (!enabled || !slug) return;
    let alive = true;
    fetch(`/api/sections?slug=${encodeURIComponent(slug)}&preview=locked`, { headers: { "Accept-Language": L } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (alive && body?.sections) setLoaded({ slug, locale: L, sections: body.sections as SectionOut[] });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [slug, L, enabled]);

  return enabled && loaded?.slug === slug && loaded.locale === L ? loaded.sections : null;
}

export function withPreview(sections: SectionOut[], preview: SectionOut[] | null): SectionOut[] {
  if (!preview) return sections;
  return sections.map((section) =>
    section.locked ? preview.find((row) => row.key === section.key) ?? section : section);
}
