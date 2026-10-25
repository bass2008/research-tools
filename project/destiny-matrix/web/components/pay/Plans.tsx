"use client";

import { useTariffs, usePaymentProviders } from "@/components/pay/TariffsProvider";
import { useOfferMode } from "@/components/pay/useOfferMode";
import { useLocale } from "@/components/ui/LocaleProvider";
import { track } from "@/lib/analytics";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedTariffs, type Tariff } from "@/lib/tariffs";
import Link from "next/link";

export const forLocale = localized((L: Locale) => {
  const { capLabel, periodLabel, priceLabel } = localizedTariffs(L);

  // Состав тарифа выводится из scope, а не хранится списком: тариф правят в базе, и отдельный
  // список возможностей разошёлся бы с правами, которые реально выдаёт оплата.
  function features(t: Tariff): string[] {
    if (t.products?.length === 1 && t.products[0] === "pair") {
      return [D.pay.pairSections[L], D.pay.pairDates[L], D.pay.noSubscription[L], D.pay.pairOpens[L], D.pay.downloadsAsPdf[L]];
    }
    const unlimited = t.scope.includes("all");
    const everything = t.products?.includes("*") ?? false;
    return [
      everything ? D.pay.allReadings[L] : D.pay.allSections[L],
      unlimited ? (everything ? D.pay.unlimitedReadings[L] : D.pay.unlimitedDates[L]) : D.pay.singleDate[L],
      ...(t.scope.includes("matrix") ? [D.pay.storedInAccount[L]] : []),
      ...(t.period_days === null
        ? [D.pay.noSubscription[L], D.pay.opensAtOnce[L], D.pay.downloadsAsPdf[L]]
        : [D.pay.openedFor[L](periodLabel(t)), D.pay.manualRenewal[L]]),
    ];
  }
  return { capLabel, periodLabel, priceLabel, features };
});

/** Номер сохранённой записи, которую откроет разовая покупка своего продукта. */
export type PlanCarry = { m?: string; r?: string };

function aimOf(t: Tariff, carry: PlanCarry | undefined): string {
  if (t.per_reading === false || !carry) return "";
  const product = t.products?.[0] ?? "personal";
  if (product === "pair") return carry.r ? `?r=${carry.r}` : "";
  return product === "personal" && carry.m ? `?m=${carry.m}` : "";
}

export default function Plans({ locale: requestedLocale, ...localeProps }: ({ place?: string; carry?: PlanCarry }) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { place = "plans", carry } = localeProps;
  const { capLabel, periodLabel, priceLabel, features } = forLocale(L);

  const tariffs = useTariffs();
  const providers = usePaymentProviders();
  // на витрине без оплаты и подписчику предлагать нечего: всё и так открыто
  if (useOfferMode() !== "sell") return null;
  if (providers?.length === 0) return <div className="panel" id="plans">{D.pay.regionUnavailable[L]}</div>;
  // цена ещё не подтверждена базой: показывать блок с ценой из кода нельзя — по ней всё равно
  // не купить, платёж идёт в тот же API
  if (!tariffs.length) return null;
  // Сравнивать не с чем, пока продаём один тариф: ни шапки «Одна дата», ни выделения
  // «выгоднее» — они появятся сами, когда в витрине снова станет больше одного тарифа.
  const compare = tariffs.length > 1;
  // Выделяем самый дорогой: он должен выглядеть дороже. Считаем по цене, чтобы выделение
  // не зависело от id и порядка.
  const premium = tariffs.reduce((a, b) => (b.price > a.price ? b : a), tariffs[0]);
  return (
    <div className={!compare ? "plans single" : tariffs.length > 2 ? "plans three" : "plans"} id="plans">
      {tariffs.map((t) => (
        <div className={compare && t.id === premium?.id ? "plan premium" : "plan"} key={t.id}>
          {compare ? <div className="pcap">{capLabel(t)}{t.id === premium?.id ? <span className="plan-value"> · {D.pay.betterValue[L]}</span> : null}</div> : null}
          <div className="in">
            <h3>{t.name}</h3>
            <div className="price">
              {priceLabel(t)} <s>{periodLabel(t)}</s>
            </div>
            <ul>
              {features(t).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link
              className="btn wide"
              data-testid={`plan-${t.id}`}
              href={`/pay/${t.id}${aimOf(t, carry)}`}
              onClick={() => {
                track("buy_click", { tariff: t.id, place });
                track("tariff_select", { tariff: t.id, place });
              }}
            >
              {D.pay.buyFor[L](priceLabel(t))}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
