import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { DEFAULT_PRICES } from "@/lib/individualPricing";

let bought = 0;
vi.mock("@/components/ui/LocaleProvider", () => ({ useLocale: () => "ru" }));
vi.mock("@/components/ui/LocalizedLink", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/components/pay/individualTerms", () => ({
  useIndividualTerms: () => ({ bought, prices: DEFAULT_PRICES, defaultYear: 2027, payable: true }),
  onePrice: (t: { bought: number; prices: typeof DEFAULT_PRICES }) => t.bought >= 3 ? t.prices.after_three : t.prices.first,
}));

const { default: FamilyReadingOffer } = await import("./FamilyReadingOffer");
const html = () => renderToStaticMarkup(<FamilyReadingOffer variant="child" />).replace(/ /g, " ");

it("promises a cheaper set only while the second reading of an order is cheaper", () => {
  bought = 0;
  expect(html()).toContain("дешевле, чем по отдельности");
  bought = 3;
  expect(html()).not.toContain("дешевле");
  expect(html()).toContain("Ваша цена после трёх разборов — 1 190 ₽ за любой.");
});
