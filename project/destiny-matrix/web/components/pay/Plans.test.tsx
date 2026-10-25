import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import Plans from "./Plans";

vi.mock("@/components/ui/LocaleProvider", () => ({ useLocale: () => "ru" }));
vi.mock("./useOfferMode", () => ({ useOfferMode: () => "sell" }));
vi.mock("./TariffsProvider", () => ({
  usePaymentProviders: () => [{ id: "mock", provider: "mock" }],
  useTariffs: () => [
    { id: "single", name: "Личная", price: 39000, scope: ["single"], products: ["personal"], period_days: null },
    { id: "pair", name: "Пара", price: 39000, scope: ["single"], products: ["pair"], period_days: null },
    { id: "month", name: "Подписка", price: 59000, scope: ["all"], products: ["*"], period_days: 90, per_reading: false },
  ],
}));

afterEach(() => vi.unstubAllGlobals());

function find(node: ReactNode, testId: string): { href: string; onClick: () => void } | undefined {
  let found: ReturnType<typeof find>;
  Children.forEach(node, (child) => {
    if (!isValidElement<{ children?: ReactNode; "data-testid"?: string; href: string; onClick: () => void }>(child)) return;
    found ??= child.props["data-testid"] === testId ? child.props : find(child.props.children, testId);
  });
  return found;
}

it.each(["single", "pair", "month"])("selecting the %s card tracks its tariff once", (tariff) => {
  const ym = vi.fn();
  vi.stubGlobal("window", { ym });
  vi.stubGlobal("document", { documentElement: { getAttribute: () => "111856670" } });
  const link = find(Plans({ locale: "ru", place: "pay" }), `plan-${tariff}`)!;
  expect(link.href).toBe(`/pay/${tariff}`);
  expect(ym).not.toHaveBeenCalled();
  link.onClick();
  expect(ym.mock.calls).toEqual([
    [111856670, "reachGoal", "buy_click", { tariff, place: "pay" }],
    [111856670, "reachGoal", "tariff_select", { tariff, place: "pay" }],
  ]);
});
