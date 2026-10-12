"use client";

import { useOfferMode } from "@/components/pay/useOfferMode";
import { useLocale } from "@/components/ui/LocaleProvider";
import type { Lang } from "./i18n/lang";
import type { MatrixListItem } from "./api";
import type { Matrix } from "./matrix";
import type { SectionOut } from "./publicSpec";
import type { LongformReading } from "./readingTypes";
import { useEffect, useState } from "react";

export type ChakraReadingStatus = "loading" | "error";

// One access rule for the chart on every page. Access is by date, not by date and sex: sex
// changes no number in the chart (engine/tests/test_method_contract.py), and the offer promises
// all 20 sections for one birth date.
export function useChakraAccess(m: Matrix | null, dates: MatrixListItem[], full: SectionOut[] | null) {
  const L = useLocale();
  const mode = useOfferMode();
  const paid = m ? dates.find((row) => row.birth === m.birth && row.access !== "locked") : undefined;
  const saved = m
    ? dates.find((row) => row.birth === m.birth && row.sex === m.sex) ?? dates.find((row) => row.birth === m.birth)
    : undefined;
  const paidId = mode === "free" ? undefined : paid?.id;
  const [own, setOwn] = useState<{ id: number; locale: Lang; reading?: LongformReading; status?: ChakraReadingStatus } | null>(null);

  useEffect(() => {
    if (paidId === undefined) return;
    let alive = true;
    setOwn({ id: paidId, locale: L, status: "loading" });
    fetch(`/api/sections?m=${paidId}&section=chakras`, { headers: { "Accept-Language": L } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { sections?: SectionOut[] } | null) => {
        const reading = body?.sections?.find((s) => s.key === "chakras")?.longform;
        if (alive) setOwn({ id: paidId, locale: L, reading, status: reading ? undefined : "error" });
      })
      .catch(() => {
        if (alive) setOwn({ id: paidId, locale: L, status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [paidId, L]);

  const anyDate = mode === "subscription";
  // Hide the old locale immediately, including the render before the new effect runs.
  const current = own?.id === paidId && own?.locale === L ? own : null;
  const reading = full?.find((s) => s.key === "chakras")?.longform ?? current?.reading;
  return {
    paid,
    saved,
    anyDate,
    unlocked: mode !== "sell" || Boolean(paid),
    reading,
    readingStatus: !reading && paidId !== undefined ? current?.status ?? "loading" : undefined,
    matrixId: saved?.id,
  };
}
