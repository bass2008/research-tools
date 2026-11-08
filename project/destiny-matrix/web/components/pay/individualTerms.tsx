"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/account/useSession";
import { useLocale } from "@/components/ui/LocaleProvider";
import { forLocale as localizedApi } from "@/lib/api";
import { DEFAULT_PRICES, defaultYearFor, type IndividualTerms, type Prices } from "@/lib/individualPricing";
import { browserDay } from "@/lib/today";

export interface Terms { bought: number; prices: Prices; defaultYear: number; payable: boolean }

// One request per language and account for every block on the page; an order changes the count.
const asked = new Map<string, Promise<IndividualTerms>>();
export function forgetIndividualTerms() { asked.clear(); }

/** Prices from the database and how many readings the buyer has paid for: from three on, any
 *  reading costs `after_three`. Until the answer comes, the seeded prices and the browser's year. */
export function useIndividualTerms(): Terms {
  const L = useLocale();
  const { status, email } = useSession();
  const [terms, setTerms] = useState<Terms>({ bought: 0, prices: DEFAULT_PRICES, defaultYear: 0, payable: true });
  useEffect(() => {
    let live = true;
    setTerms((t) => ({ ...t, defaultYear: t.defaultYear || defaultYearFor(browserDay()) }));
    if (status === "loading") return;
    const key = `${L}|${status === "user" ? email : ""}`;
    if (!asked.has(key)) asked.set(key, localizedApi(L).api.individualTerms());
    asked.get(key)!
      .then((t) => { if (live) setTerms({ bought: t.bought, prices: t.prices, defaultYear: t.default_year, payable: t.payable !== false }); })
      .catch(() => asked.delete(key));
    return () => { live = false; };
  }, [status, email, L]);
  return terms;
}

/** What one reading costs this buyer: from three paid on, `after_three`. */
export const onePrice = (t: Terms) => t.bought >= 3 ? t.prices.after_three : t.prices.first;

/** Any year can be chosen; the input only keeps it a plausible one. */
export function YearInput({ value, onChange, label }: { value: number; onChange: (y: number) => void; label: string }) {
  return <input className="iyear" type="number" inputMode="numeric" min={1900} max={2200} value={value || ""} aria-label={label}
    onChange={(e) => { const y = Math.trunc(Number(e.target.value)); if (y) onChange(y); }} />;
}
