"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ApiError, forLocale } from "@/lib/api";
import type { IndividualPage } from "@/lib/individualReading";

export function useIndividualReadings(enabled: boolean, page: number) {
  const L = useLocale(), en = L === "en";
  const [data, setData] = useState<IndividualPage | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let live = true; setError("");
    forLocale(L).api.individualReadings(page).then(value => { if (live) setData(value); })
      .catch(e => { if (live) setError(e instanceof ApiError ? e.messageFor(L) : en ? "Unable to load individual readings" : "Не удалось загрузить индивидуальные разборы"); });
    return () => { live = false; };
  }, [enabled, L, page, en]);
  return { data, error };
}
