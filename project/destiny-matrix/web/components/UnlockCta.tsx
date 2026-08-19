"use client";

import Link from "next/link";

import { track } from "@/lib/analytics";

import { useLead } from "./TariffsProvider";

/**
 * Кнопка покупки. Отдельным клиентским компонентом, чтобы вокруг неё жила серверная разметка:
 * страница разбора печатается на сервере, а цель Метрики без обработчика клика не поставить.
 * Ведёт на `/pay`: цену и состав человек видит на экране оплаты, а не угадывает по кнопке.
 */
export default function UnlockCta({
  place,
  section,
  className = "btn",
  children,
  testId,
}: {
  place: string;
  section?: string;
  className?: string;
  children?: React.ReactNode;
  testId?: string;
}) {
  const lead = useLead();
  return (
    <Link
      className={className}
      data-testid={testId}
      href="/pay"
      onClick={() => track("buy_click", { tariff: lead.id, place, ...(section ? { section } : {}) })}
    >
      {children ?? "Купить"}
    </Link>
  );
}
