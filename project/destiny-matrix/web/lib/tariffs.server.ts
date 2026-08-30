import { apiUpstream } from "./settings/server";
import type { Tariff } from "./tariffs";

// Лендинг, оплата и оферта рендерятся на запрос и берут прайс здесь. Серверный модуль отделён
// от общих функций форматирования: API_INTERNAL_URL никогда не попадает в клиентский граф.

/** Чем принимаются деньги: true — мок, деньги ненастоящие. */
export async function testPayments(): Promise<boolean> {
  const base = apiUpstream();
  try {
    const res = await fetch(`${base}/api/tariffs`, { cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { test_payments?: boolean };
    return body.test_payments === true;
  } catch {
    return false;
  }
}

/** Прайс с сервера. Пустой список — «цены нет»: API молчит или витрина пуста. */
export async function getTariffs(): Promise<Tariff[]> {
  const base = apiUpstream();
  try {
    const res = await fetch(`${base}/api/tariffs`, { cache: "no-store" });
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: Tariff[] };
    return Array.isArray(body.items) ? body.items : [];
  } catch {
    return [];
  }
}
