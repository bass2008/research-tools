import Link from "next/link";

import PayForm from "@/components/PayForm";
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
    <main className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <span>Оплата</span>
        </p>
        <h1>Оплата</h1>
        <p className="dim">
          Оставьте почту и пароль — доступ живёт в аккаунте, а не в браузере.
          {test ? " Приём оплаты сейчас тестовый: списаний не происходит." : ""}
        </p>
        <PayForm tariffs={tariffs} initial={initial} test={test} />
      </div>
    </main>
  );
}
