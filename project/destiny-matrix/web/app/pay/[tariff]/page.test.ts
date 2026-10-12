import { beforeEach, expect, it, vi } from "vitest";
import { D } from "@/lib/i18n";
import { billingFor } from "@/lib/tariffs.server";
import { requestLocale } from "@/lib/i18n/request";
import PayPage, { generateMetadata } from "./page";

vi.mock("@/lib/access", () => ({ ALL_FREE: false }));
vi.mock("@/lib/tariffs.server", () => ({ billingFor: vi.fn() }));
vi.mock("@/lib/i18n/request", () => ({ requestLocale: vi.fn() }));
vi.mock("@/lib/siteProfile.server", () => ({ requestSite: vi.fn(async () => ({
  origin: "https://arcana-sense.com", defaultLocale: "en", locales: ["en", "ru"], legalLocale: "en", indexable: true,
})) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

const params = Promise.resolve({ tariff: "single" });
beforeEach(() => { vi.mocked(requestLocale).mockResolvedValue("en"); });

it.each(["en", "ru"] as const)("keeps the requested tariff and retry screen during an API outage (%s)", async (locale) => {
  vi.mocked(requestLocale).mockResolvedValue(locale);
  vi.mocked(billingFor).mockResolvedValue({ items: [], providers: null, test: false, products: [], product: "personal" });
  const page = await PayPage({ params });
  expect(page.props).toMatchObject({ initial: "single", providers: null, tariffs: [], locale });
  const metadata = await generateMetadata({ params });
  expect(metadata.title).toBe(D.pay.pageTitle[locale]);
  expect(metadata.robots).toMatchObject({ index: false });
});

it("still rejects an unknown tariff when the API answered successfully", async () => {
  vi.mocked(billingFor).mockResolvedValue({ items: [], providers: [], test: false, products: ["personal"], product: "personal" });
  await expect(PayPage({ params })).rejects.toThrow("NOT_FOUND");
  const metadata = await generateMetadata({ params });
  expect(metadata.title).not.toBe(D.pay.pageTitle.en);
});

it("restores the selected tariff after the API recovers", async () => {
  const items = [{ id: "single", name: "Reading", price: 25000, scope: ["single"], period_days: null }];
  vi.mocked(billingFor).mockResolvedValue({ items, providers: [{ id: "mock", provider: "mock" }], test: true, products: ["personal"], product: "personal" });
  const page = await PayPage({ params });
  expect(page.props).toMatchObject({ initial: "single", tariffs: items, test: true });
  expect((await generateMetadata({ params })).title).toContain("Reading");
});

it("sells only the chosen couple reading: the choice of three is made on /pay", async () => {
  const items = [
    { id: "pair", name: "Couple", price: 25000, scope: ["single"], period_days: null, products: ["pair"], per_reading: true },
    { id: "month", name: "All", price: 24000, scope: ["single", "matrix", "all"], period_days: 90, products: ["*"], per_reading: false },
  ];
  vi.mocked(billingFor).mockResolvedValue({ items, providers: [{ id: "mock", provider: "mock" }], test: true, products: ["personal", "pair"], product: "pair" });
  const page = await PayPage({ params: Promise.resolve({ tariff: "pair" }) });
  expect(vi.mocked(billingFor)).toHaveBeenLastCalledWith("pair");
  expect(page.props).toMatchObject({ initial: "pair", tariffs: [items[0]], product: "pair" });
});
