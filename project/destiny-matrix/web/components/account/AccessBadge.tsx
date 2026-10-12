"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import { D, forLocale as localizedI18n } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";

/**
 * Метка доступа у строки разбора — матрицы или пары. Купленная выделена особо: она остаётся у
 * человека, даже когда подписка кончится. Знак пожизненного владения — ∞ в золотом круге.
 * Выданная админом открыта так же, но золота не получает: подарок — не покупка.
 */
export default function AccessBadge({ locale: requestedLocale, item }: {
  locale?: Locale;
  item: { access: string; access_until?: string | null; access_granted?: boolean };
}) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { dayLabel } = localizedI18n(L);

  if (item.access === "forever") {
    return (
      <span className="badge own" data-testid="access-badge">
        <i className="lifetime" aria-hidden="true">
          ∞
        </i>
        {D.account.badgeBought[L]}
      </span>
    );
  }
  if (item.access === "open") {
    // витрина без оплаты: открыта всем, покупкой не является
    return <span className="badge sub" data-testid="access-badge">{D.account.badgeOpen[L]}</span>;
  }
  if (item.access === "granted") {
    return <span className="badge sub" data-testid="access-badge">{D.account.badgeGranted[L]}</span>;
  }
  if (item.access === "subscription") {
    return (
      <span className="badge sub" data-testid="access-badge">
        {D.account.badgeSubscription[L](item.access_until ? dayLabel(item.access_until) : "")}
        {item.access_granted ? D.account.grantedTail[L] : ""}
      </span>
    );
  }
  return <span className="badge off" data-testid="access-badge">{D.account.badgeClosed[L]}</span>;
}
