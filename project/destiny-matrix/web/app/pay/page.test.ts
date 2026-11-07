import { beforeEach, expect, it, vi } from "vitest";
import { allOffers, getBilling } from "@/lib/tariffs.server";
import { requestLocale } from "@/lib/i18n/request";
import PayChoicePage from "./page";

vi.mock("@/lib/access", () => ({ ALL_FREE: false }));
vi.mock("@/lib/tariffs.server", () => ({ allOffers: vi.fn(), getBilling: vi.fn() }));
vi.mock("@/lib/i18n/request", () => ({ requestLocale: vi.fn() }));
vi.mock("@/lib/siteProfile.server", () => ({ requestSite: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); },
}));

const offers = [
  { id: "single", name: "One date", price: 25000, scope: ["single"], period_days: null, products: ["personal"], per_reading: true },
  { id: "pair", name: "Couple", price: 25000, scope: ["single"], period_days: null, products: ["pair"], per_reading: true },
  { id: "month", name: "Subscription", price: 39000, scope: ["single", "matrix", "all"], period_days: 90, products: ["*"], per_reading: false },
];

beforeEach(() => {
  vi.mocked(requestLocale).mockResolvedValue("ru");
  vi.mocked(allOffers).mockResolvedValue(offers);
  vi.mocked(getBilling).mockResolvedValue({ items: [], providers: [{ id: "mock", provider: "mock" }], test: true, products: ["personal", "pair"], product: "personal" });
});

const page = (search: Record<string, string> = {}) => PayChoicePage({ searchParams: Promise.resolve(search) });

type Props = { server?: unknown; carry?: unknown; pair?: boolean; children?: unknown };
type Node = { props?: Props } | Node[] | null | undefined;
function find(node: Node, key: keyof Props): unknown {
  if (!node) return undefined;
  if (Array.isArray(node)) return node.map((n) => find(n, key)).find((v) => v !== undefined);
  if (node.props && key in node.props) return node.props[key];
  return find(node.props?.children as Node, key);
}
const ids = (node: unknown) => (find(node as Node, "server") as typeof offers).map((t) => t.id);

it("«Купить» without a product offers all three purchases", async () => {
  expect(ids(await page())).toEqual(["single", "pair", "month"]);
});

// One page wherever "Buy" was pressed (docs/individual-reading.md): the product only carries its record.
it("a personal reading still shows all three offers and carries the saved matrix", async () => {
  const node = await page({ m: "12" });
  expect(ids(node)).toEqual(["single", "pair", "month"]);
  expect(find(node as Node, "carry")).toEqual({ m: "12", r: undefined });
});

it("a couple still shows all three offers and carries the saved reading", async () => {
  const node = await page({ r: "7" });
  expect(ids(node)).toEqual(["single", "pair", "month"]);
  expect(find(node as Node, "carry")).toEqual({ m: undefined, r: "7" });
});

it("a broken record number is not carried into the form", async () => {
  expect(find((await page({ m: "12abc" })) as Node, "carry")).toEqual({ m: undefined, r: undefined });
});

it("the leftover product parameter changes nothing", async () => {
  expect(find((await page({ for: "personal", m: "12" })) as Node, "carry")).toEqual({ m: "12", r: undefined });
});
