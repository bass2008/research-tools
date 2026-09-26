"use client";

import { useLead, usePriceKnown, usePaymentProviders } from "@/components/pay/TariffsProvider";
import { useLocale } from "@/components/ui/LocaleProvider";
import { track } from "@/lib/analytics";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import Link from "next/link";

/**
 * Кнопка покупки. Отдельным клиентским компонентом, чтобы вокруг неё жила серверная разметка:
 * страница разбора печатается на сервере, а цель Метрики без обработчика клика не поставить.
 * Ведёт на `/pay`: цену и состав человек видит на экране оплаты, а не угадывает по кнопке.
 * С `matrixId` — на оплату именно этой даты: иначе экран оплаты предложит первую закрытую,
 * и деньги откроют не то, что человек читал.
 */
export default function UnlockCta({ locale: requestedLocale, ...localeProps }: ({
  place: string;
  section?: string;
  className?: string;
  children?: React.ReactNode;
  testId?: string;
  matrixId?: number | null;
}) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const {
    place,
    section,
    className = "btn",
    children,
    testId,
    matrixId,
  } = localeProps;

  const lead = useLead();
  const known = usePriceKnown();
  const providers = usePaymentProviders();
  if (providers?.length === 0) return <p className="dim">{D.pay.regionUnavailable[L]}</p>;
  if (!known || !lead) {
    return (
      <button className={className} data-testid={testId} type="button" disabled>
        {children ?? D.nav.buy[L]}
      </button>
    );
  }
  return (
    <Link
      className={className}
      data-testid={testId}
      href={matrixId ? `/pay?m=${matrixId}` : "/pay"}
      onClick={() => track("buy_click", { tariff: lead.id, place, ...(section ? { section } : {}) })}
    >
      {children ?? D.nav.buy[L]}
    </Link>
  );
}
