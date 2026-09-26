import { cache } from "react";
import { ALL_FREE } from "./access";
import { requestLocale } from "./i18n/request";
import { apiUpstream } from "./settings/server";
import { requestSiteHeaders } from "./siteProfile.server";
import type { PaymentProvider, Tariff } from "./tariffs";

// cache дедуплицирует только внутри серверного рендера, не между доменами/запросами.
export const getBilling = cache(async (): Promise<{
  items: Tariff[]; providers: PaymentProvider[] | null; test: boolean;
}> => {
  const unknown = { items: [], providers: null, test: false };
  if (ALL_FREE) return unknown;
  try {
    const res = await fetch(`${apiUpstream()}/api/tariffs`, {
      cache: "no-store",
      headers: { "Accept-Language": await requestLocale(), ...await requestSiteHeaders() },
    });
    if (!res.ok) return unknown;
    const body = await res.json();
    return {
      items: Array.isArray(body.items) ? body.items : [],
      // null = ошибка/неизвестно; [] = API подтвердил отсутствие способов оплаты.
      providers: Array.isArray(body.payment_providers) ? body.payment_providers : null,
      test: body.test_payments === true,
    };
  } catch {
    return unknown;
  }
});

export async function getTariffs(): Promise<Tariff[]> {
  return (await getBilling()).items;
}
