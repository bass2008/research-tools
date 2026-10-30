"use client";

import { useLead, usePriceKnown, usePaymentProviders } from "@/components/pay/TariffsProvider";
import { useOfferMode } from "@/components/pay/useOfferMode";
import { useLocale } from "@/components/ui/LocaleProvider";
import { track } from "@/lib/analytics";
import { buyHref } from "@/lib/readingLinks";
import { alignBirth, type StoredBirth } from "@/lib/storage";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import Link from "@/components/ui/LocalizedLink";

/**
 * Кнопка покупки. Отдельным клиентским компонентом, чтобы вокруг неё жила серверная разметка:
 * страница разбора печатается на сервере, а цель Метрики без обработчика клика не поставить.
 * Ведёт на выбор «эта дата или подписка»: цену и состав человек видит там, а не угадывает по
 * кнопке. С `matrixId` форма откроет именно эту дату: иначе предложит первую закрытую, и деньги
 * откроют не то, что человек читал.
 */
export default function UnlockCta({ locale: requestedLocale, ...localeProps }: ({
  place: string;
  section?: string;
  className?: string;
  children?: React.ReactNode;
  testId?: string;
  matrixId?: number | null;
  birth?: StoredBirth;
  unavailable?: React.ReactNode;
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
    birth,
    unavailable = <p className="dim">{D.pay.regionUnavailable[L]}</p>,
  } = localeProps;

  const lead = useLead();
  const known = usePriceKnown();
  const providers = usePaymentProviders();
  if (useOfferMode() !== "sell") return null;
  if (providers?.length === 0) return unavailable;
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
      href={buyHref("personal", matrixId)}
      onClick={() => {
        // A live preview may not have been submitted. Checkout must use the displayed date.
        if (!matrixId && birth) alignBirth(birth);
        track("buy_click", { tariff: lead.id, place, ...(section ? { section } : {}) });
      }}
    >
      {children ?? D.nav.buy[L]}
    </Link>
  );
}
