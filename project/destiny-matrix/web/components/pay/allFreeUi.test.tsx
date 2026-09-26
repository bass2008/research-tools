import { D, L } from "@/lib/i18n";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Витрина без оплаты — переменная сборки, поэтому в тесте её подменяет модуль целиком.
vi.mock("@/lib/access", () => ({ ALL_FREE: true }));
vi.mock("@/components/pay/TariffsProvider", () => ({
  useTariffs: () => [{ id: "single", name: "Разбор", price: 25000, scope: ["single"], period_days: null }],
  useLead: () => ({ id: "single", name: "Разбор", price: 25000, scope: ["single"], period_days: null }),
  usePriceKnown: () => true,
  usePaymentProviders: () => [],
}));

import Header from "@/components/ui/Header";
import Plans from "@/components/pay/Plans";
import { PriceOrFree } from "@/components/pay/Price";

describe("интерфейс на витрине без оплаты", () => {
  it("не предлагает купить в шапке", () => {
    const html = renderToStaticMarkup(<Header />);
    expect(html).not.toContain("buy-top");
    expect(html).toContain(D.nav.encyclopedia[L]);
  });

  it("не печатает тарифы", () => {
    expect(renderToStaticMarkup(<Plans />)).toBe("");
  });

  it("закрывает предложение словом, а не ценой", () => {
    const html = renderToStaticMarkup(<PriceOrFree />);
    expect(html).toContain(D.pay.freeWord[L]);
    expect(html).not.toContain("₽");
    expect(html).not.toContain("$");
  });
});
