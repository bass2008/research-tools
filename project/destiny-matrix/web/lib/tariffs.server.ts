import { cache } from "react";
import { ALL_FREE } from "./access";
import { requestLocale } from "./i18n/request";
import { apiUpstream } from "./settings/server";
import { requestSiteHeaders } from "./siteProfile.server";
import type { PaymentProvider, Tariff } from "./tariffs";

export interface Billing {
  items: Tariff[];
  providers: PaymentProvider[] | null;
  test: boolean;
  /** включённые продукты контура */
  products: string[];
  /** продукт, для которого собрана витрина */
  product: string;
}

// cache дедуплицирует только внутри серверного рендера, не между доменами/запросами.
// Без продукта — витрина личного разбора.
export const getBilling = cache(async (product = "personal"): Promise<Billing> => {
  const unknown = { items: [], providers: null, test: false, products: [], product };
  if (ALL_FREE) return unknown;
  try {
    const res = await fetch(`${apiUpstream()}/api/tariffs?product=${encodeURIComponent(product)}`, {
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
      products: Array.isArray(body.products) ? body.products : [],
      product,
    };
  } catch {
    return unknown;
  }
});

/** Витрина, в которой продаётся предложение `id`: у каждого продукта своя, подписка — во всех. */
export async function billingFor(id: string): Promise<Billing> {
  const personal = await getBilling();
  if (personal.items.some((t) => t.id === id) || personal.providers === null) return personal;
  for (const product of personal.products) {
    if (product === "personal") continue;
    const billing = await getBilling(product);
    if (billing.items.some((t) => t.id === id && t.per_reading)) return billing;
  }
  return personal;
}

export async function getTariffs(): Promise<Tariff[]> {
  return (await getBilling()).items;
}

/** Все предложения всех включённых продуктов — для оферты: в ней перечислено всё, что продаётся. */
export async function allOffers(): Promise<Tariff[]> {
  const personal = await getBilling();
  const out = [...personal.items];
  for (const product of personal.products) {
    if (product === "personal") continue;
    for (const offer of (await getBilling(product)).items) {
      if (!out.some((t) => t.id === offer.id)) out.push(offer);
    }
  }
  return out;
}
