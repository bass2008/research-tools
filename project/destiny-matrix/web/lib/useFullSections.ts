"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import { useEffect, useState } from "react";
import { ALL_FREE } from "./access";
import type { Matrix } from "./matrix";
import type { SectionOut } from "./publicSpec";

/**
 * Полный разбор карты для браузера на витрине без оплаты и подписчику.
 *
 * Толкования восемнадцати разделов в клиентский чанк не кладутся и там, где они бесплатны:
 * это полкорпуса на каждую страницу. Браузер запрашивает их по слагу карты — три свёрнутых
 * числа, по которым дата рождения не восстанавливается.
 */
export function useFullSections(matrix: Matrix | null, open: boolean = ALL_FREE): SectionOut[] | null {
  const L = useLocale();

  const [sections, setSections] = useState<SectionOut[] | null>(null);
  const slug = matrix ? `${matrix.day}-${matrix.month}-${matrix.year}` : "";

  useEffect(() => {
    if (!open || !slug) return;
    let alive = true;
    setSections(null);
    fetch(`/api/sections?slug=${encodeURIComponent(slug)}`, { headers: { "Accept-Language": L } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (alive && body?.sections) setSections(body.sections as SectionOut[]);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [slug, L, open]);

  return sections;
}
