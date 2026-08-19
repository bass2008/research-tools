import Link from "next/link";

import PayForm from "@/components/PayForm";
import type { Tariff } from "@/lib/tariffs";

// Экран оплаты один на два маршрута: `/pay` (выбор с нуля) и `/pay/<тариф>` (тариф выбран
// ссылкой из карточки). Отличаются только тем, что отмечено при открытии.
export default function PayScreen({ tariffs, initial }: { tariffs: Tariff[]; initial: string }) {
  return (
    <main className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <Link href="/#plans">Тарифы</Link> <span>/</span>{" "}
          <span>Оплата</span>
        </p>
        <h1>Оплата</h1>
        <p className="dim">
          Выберите тариф и оставьте почту — доступ живёт в аккаунте, а не в браузере. Приём оплаты
          сейчас тестовый: провайдер подключается за тем же интерфейсом. Автосписаний нет ни в одном
          тарифе — срочный доступ продлевается вручную.
        </p>
        <PayForm tariffs={tariffs} initial={initial} />
      </div>
    </main>
  );
}
