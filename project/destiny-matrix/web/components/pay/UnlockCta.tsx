"use client";

import Link from "next/link";

import { track } from "@/lib/analytics";

import { useLead } from "@/components/pay/TariffsProvider";

/**
 * Кнопка покупки. Отдельным клиентским компонентом, чтобы вокруг неё жила серверная разметка:
 * страница разбора печатается на сервере, а цель Метрики без обработчика клика не поставить.
 * Ведёт на `/pay`: цену и состав человек видит на экране оплаты, а не угадывает по кнопке.
 * С `matrixId` — на оплату именно этой даты: иначе экран оплаты предложит первую закрытую,
 * и деньги откроют не то, что человек читал.
 */
export default function UnlockCta({
  place,
  section,
  className = "btn",
  children,
  testId,
  matrixId,
}: {
  place: string;
  section?: string;
  className?: string;
  children?: React.ReactNode;
  testId?: string;
  matrixId?: number | null;
}) {
  const lead = useLead();
  return (
    <Link
      className={className}
      data-testid={testId}
      href={matrixId ? `/pay?m=${matrixId}` : "/pay"}
      onClick={() => track("buy_click", { tariff: lead.id, place, ...(section ? { section } : {}) })}
    >
      {children ?? "Купить"}
    </Link>
  );
}
