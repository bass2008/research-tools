"use client";

import { useSession } from "@/components/account/useSession";
import { useLocale } from "@/components/ui/LocaleProvider";
import { forLocale as localizedApi, type MatrixListItem } from "./api";
import { useEffect, useState } from "react";

export function useSavedDates(): { dates: MatrixListItem[]; ready: boolean } {
  const { api } = localizedApi(useLocale());
  const session = useSession();
  const [dates, setDates] = useState<MatrixListItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (session.status === "loading") {
      setReady(false);
      return;
    }
    if (session.status !== "user") {
      setDates([]);
      setReady(true);
      return;
    }
    let alive = true;
    setReady(false);
    api
      .matrices()
      .then((res) => {
        if (!alive) return;
        setDates(res.items);
        setReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setDates([]);
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [session.status, api]);

  return { dates, ready };
}
