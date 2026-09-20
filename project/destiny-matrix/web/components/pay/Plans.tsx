"use client";

import Link from "next/link";

import { ALL_FREE } from "@/lib/access";
import { D, L } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { type Tariff, capLabel, periodLabel, priceLabel } from "@/lib/tariffs";

import { useTariffs } from "@/components/pay/TariffsProvider";

// Состав тарифа выводится из scope, а не хранится списком: тариф правят в базе, и отдельный
// список возможностей разошёлся бы с правами, которые реально выдаёт оплата.
function features(t: Tariff): string[] {
  const unlimited = t.scope.includes("all");
  return [
    D.pay.allSections[L],
    unlimited ? D.pay.unlimitedDates[L] : D.pay.singleDate[L],
    ...(t.scope.includes("matrix") ? [D.pay.storedInAccount[L]] : []),
    ...(t.period_days === null
      ? [D.pay.noSubscription[L], D.pay.opensAtOnce[L], D.pay.downloadsAsPdf[L]]
      : [D.pay.openedFor[L](periodLabel(t)), D.pay.manualRenewal[L]]),
  ];
}

export default function Plans({ place = "plans" }: { place?: string }) {
  const tariffs = useTariffs();
  // на витрине без оплаты кассы нет: тариф показывать нечем и незачем
  if (ALL_FREE) return null;
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
    <div className={compare ? "plans" : "plans single"} id="plans">
      {tariffs.map((t) => (
        <div className={compare && t.id === premium?.id ? "plan premium" : "plan"} key={t.id}>
          {compare ? <div className="pcap">{capLabel(t)}</div> : null}
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
              href={`/pay/${t.id}`}
              onClick={() => track("buy_click", { tariff: t.id, place })}
            >
              {D.pay.buyFor[L](priceLabel(t))}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
