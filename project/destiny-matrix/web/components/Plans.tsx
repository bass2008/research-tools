"use client";

import Link from "next/link";

import { track } from "@/lib/analytics";
import { type Tariff, capLabel, money, periodLabel } from "@/lib/tariffs";

import { useTariffs } from "./TariffsProvider";

// Состав тарифа выводится из scope, а не хранится списком: тариф правят в базе, и отдельный
// список возможностей разошёлся бы с правами, которые реально выдаёт оплата.
function features(t: Tariff): string[] {
  const unlimited = t.scope.includes("all");
  return [
    "Все 20 разделов разбора",
    unlimited ? "Любое число дат рождения" : "Одна дата рождения",
    ...(t.scope.includes("matrix") ? ["Матрицы хранятся в кабинете"] : []),
    ...(t.period_days === null
      ? ["Остаётся у вас навсегда", "Открывается сразу после оплаты", "Доступ с любого устройства"]
      : [`Открыто ${periodLabel(t)}, дальше закрывается`, "Без автосписаний: продление вручную"]),
  ];
}

export default function Plans({ place = "plans" }: { place?: string }) {
  const tariffs = useTariffs();
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
              {money(t.price)} ₽ <s>{periodLabel(t)}</s>
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
              Купить за {money(t.price)} ₽
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
