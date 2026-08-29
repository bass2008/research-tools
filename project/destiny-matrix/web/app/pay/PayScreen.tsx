"use client";

import Link from "next/link";

import PayForm from "@/components/pay/PayForm";
import TariffsProvider from "@/components/pay/TariffsProvider";
import type { Tariff } from "@/lib/tariffs";

// Экран оплаты один на два маршрута: `/pay` (выбор с нуля) и `/pay/<тариф>` (тариф выбран
// ссылкой из карточки). Отличаются только тем, что отмечено при открытии.
export default function PayScreen({
  tariffs,
  initial,
  test,
}: {
  tariffs: Tariff[];
  initial: string;
  /** true — деньги ненастоящие (мок). Приходит с сервера: вшитое обещание «оплата тестовая»
   *  показывалось покупателям и после подключения боевого терминала. */
  test: boolean;
}) {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <span>Оплата</span>
        </p>
        <h1>Оплата</h1>
        {/* прайс приходит из базы; если его нет — API недоступен, и платёж всё равно не
            пройдёт. Называть цену из кода в этот момент нельзя. */}
        {tariffs.length ? (
          <TariffsProvider server={tariffs}>
            <PayForm tariffs={tariffs} initial={initial} test={test} />
          </TariffsProvider>
        ) : (
          <div className="panel paybox">
            <h3>Цена уточняется</h3>
            <p className="dim">
              Справочник цен сейчас недоступен, поэтому оплату открыть не можем. Обновите
              страницу через минуту — расчёт карты работает и без этого.
            </p>
            <button className="btn wide" type="button" onClick={() => window.location.reload()}>
              Обновить
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
