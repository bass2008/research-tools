import { afterEach, expect, it, vi } from "vitest";
import BuyLink from "./BuyLink";

afterEach(() => vi.unstubAllGlobals());

it.each(["pair-main", "pair-section", "pair-chakra"])("tracks one purchase click from %s", (place) => {
  const ym = vi.fn();
  vi.stubGlobal("window", { ym });
  vi.stubGlobal("document", { documentElement: { getAttribute: () => "111856670" } });
  const analytics = { tariff: "pair", place, section: "chakras" };
  const link = BuyLink({ href: "/pay?for=pair&r=42", className: "btn gold", analytics, children: "Открыть" });
  expect(link.props.href).toBe("/pay?for=pair&r=42");
  expect(link.props.className).toBe("btn gold");
  expect(ym).not.toHaveBeenCalled();
  link.props.onClick();
  expect(ym.mock.calls).toEqual([[111856670, "reachGoal", "buy_click", analytics]]);
  expect(window.dataLayer).toEqual([{ event: "buy_click", ...analytics }]);
});
