import { D, forLocale as localizedI18n } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";

/** Строка сводки прав, как её отдаёт API (`access.holdings`). */
export interface Holding {
  kind: "subscription" | "reading";
  source: "bought" | "granted";
  product?: string;
  products?: string[];
  /** имя подписки из справочника — одно на кабинет, админку и платежи */
  name?: string | null;
  count?: number;
  until?: string | null;
}

export interface HoldingLine {
  text: string;
  /** купленное навсегда: в кабинете у строки знак ∞ */
  lifetime: boolean;
}

export function holdingList(value: unknown): Holding[] {
  if (!Array.isArray(value)) return [];
  return value.filter((h): h is Holding => Boolean(h) && typeof h === "object"
    && (h.kind === "subscription" || h.kind === "reading") && (h.source === "bought" || h.source === "granted"));
}

/**
 * Сводка прав словами — одна для кабинета и админки. Экраны выводят её строки как есть: пока
 * каждый собирал «Доступ» сам, у пары и у выданного всякий раз находилась непокрытая комбинация.
 */
export const forLocale = localized((L: Locale) => {
  const { dayLabel } = localizedI18n(L);

  function counted(product: string | undefined, n: number): string {
    if (product === "pair") return D.account.pairsCount[L](n);
    if (product === "personal") return D.account.datesCount[L](n);
    return D.account.readingsCount[L](n);
  }

  function holdingLines(items: Holding[]): HoldingLine[] {
    return items.map((h) => h.kind === "subscription"
      ? {
          text: `${h.name || D.account.subscriptionAll[L]}`
            + `${h.until ? D.account.until[L](dayLabel(h.until)) : ""}`
            + `${h.source === "granted" ? D.account.grantedTail[L] : ""}`,
          lifetime: false,
        }
      : {
          text: (h.source === "bought" ? D.account.readingsBought : D.account.readingsGranted)[L](
            counted(h.product, h.count ?? 0)),
          lifetime: h.source === "bought",
        });
  }

  return { holdingLines };
});
