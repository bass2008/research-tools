"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Кнопка «Купить» в шапке.
 *
 *  Ссылка вела на голый `/pay`, а тот выбирает цель из даты в браузере: на странице сохранённой
 *  закрытой матрицы платёж уходил за другую дату. Номер матрицы из адреса страницы снимает
 *  двусмысленность — так же, как это делают все остальные кнопки покупки на этой странице. */
export default function BuyButton() {
  const path = usePathname();
  const matrix = /^\/matrices\/(\d+)$/.exec(path ?? "");
  const href = matrix ? `/pay?m=${matrix[1]}` : "/pay";
  return (
    <Link className="btn sm" data-testid="buy-top" href={href}>
      Купить
    </Link>
  );
}
