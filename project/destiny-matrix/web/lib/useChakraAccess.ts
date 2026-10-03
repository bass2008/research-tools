"use client";

import { useSession } from "@/components/account/useSession";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ALL_FREE } from "./access";
import type { MatrixListItem } from "./api";
import type { Matrix } from "./matrix";
import type { SectionOut } from "./publicSpec";
import type { LongformReading } from "./readingTypes";
import { useEffect, useState } from "react";

// One access rule for the chart on every page. Access is by date, not by date and sex: sex
// changes no number in the chart (engine/tests/test_method_contract.py), and the offer promises
// all 20 sections for one birth date.
export function useChakraAccess(m: Matrix | null, dates: MatrixListItem[], full: SectionOut[] | null) {
  const L = useLocale();
  const session = useSession();
  const paid = m ? dates.find((row) => row.birth === m.birth && row.access !== "locked") : undefined;
  const saved = m
    ? dates.find((row) => row.birth === m.birth && row.sex === m.sex) ?? dates.find((row) => row.birth === m.birth)
    : undefined;
  const paidId = ALL_FREE ? undefined : paid?.id;
  const [own, setOwn] = useState<{ id: number; reading: LongformReading } | null>(null);

  useEffect(() => {
    if (paidId === undefined) return;
    let alive = true;
    fetch(`/api/sections?m=${paidId}&section=chakras`, { headers: { "Accept-Language": L } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { sections?: SectionOut[] } | null) => {
        const reading = body?.sections?.find((s) => s.key === "chakras")?.longform;
        if (alive && reading) setOwn({ id: paidId, reading });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [paidId, L]);

  const anyDate = session.status === "user" && session.unlimited;
  return {
    paid,
    saved,
    anyDate,
    unlocked: ALL_FREE || Boolean(paid) || anyDate,
    reading: full?.find((s) => s.key === "chakras")?.longform ?? (own?.id === paidId ? own?.reading : undefined),
    matrixId: saved?.id,
  };
}
