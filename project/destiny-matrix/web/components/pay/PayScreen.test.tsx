import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import PayScreen from "@/app/pay/PayScreen";
import { D } from "@/lib/i18n";
import type { Tariff } from "@/lib/tariffs";

vi.mock("@/components/pay/PayForm", () => ({ default: () => <form data-testid="payment-form" /> }));
const tariffs: Tariff[] = [{ id: "single", name: "Reading", price: 25000, scope: ["single"], period_days: null }];

it.each(["ru", "en"] as const)("explains unavailable regional payments in %s and hides checkout", (locale) => {
  const html = renderToStaticMarkup(<PayScreen locale={locale} tariffs={tariffs} initial="single" test={false} providers={[]} />);
  expect(html).toContain(D.pay.regionUnavailable[locale]);
  expect(html).not.toContain("payment-form");
  expect(html).not.toContain(D.encLinks.priceUnknownTitle[locale]);
});

it("keeps an upstream outage distinct from an empty list of providers", () => {
  const html = renderToStaticMarkup(<PayScreen locale="en" tariffs={[]} initial="" test={false} providers={null} />);
  expect(html).toContain(D.encLinks.priceUnknownTitle.en);
  expect(html).not.toContain(D.pay.regionUnavailable.en);
});

it("shows checkout only when a payment method is available", () => {
  const html = renderToStaticMarkup(<PayScreen locale="ru" tariffs={tariffs} initial="single" test providers={[{ id: "mock", provider: "mock" }]} />);
  expect(html).toContain("payment-form");
});
