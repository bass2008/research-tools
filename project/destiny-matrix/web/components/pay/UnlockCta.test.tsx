import { afterEach, expect, it, vi } from "vitest";
import { isValidElement, type ComponentProps } from "react";
import { alignBirth, clearBirth, loadBirth, takeCalculationRequest } from "@/lib/storage";
import { forLocale } from "@/lib/paytarget";
import UnlockCta from "./UnlockCta";

vi.mock("@/components/ui/LocaleProvider", () => ({ useLocale: () => "ru" }));
vi.mock("@/components/pay/TariffsProvider", () => ({
  useLead: () => ({ id: "single" }),
  usePriceKnown: () => true,
  usePaymentProviders: () => ["mock"],
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

const preview = { birth: "1993-03-31", sex: "f" as const };
const previous = { birth: "1990-01-01", sex: "m" as const };
afterEach(() => clearBirth());

function purchaseLink(props: ComponentProps<typeof UnlockCta>) {
  const element = UnlockCta(props);
  if (!isValidElement<{ href: string; onClick: () => void }>(element)) throw new Error("Expected a purchase link");
  return element;
}

it.each([false, true])("buys the displayed preview with previous calculation=%s", (hasPrevious) => {
  if (hasPrevious) alignBirth(previous);
  const button = purchaseLink({ place: "report", birth: preview });
  // Merely rendering an example must not replace the visitor's calculation.
  expect(loadBirth()).toEqual(hasPrevious ? previous : null);
  expect(button.props.href).toBe("/pay");
  button.props.onClick();
  expect(loadBirth()).toEqual(preview);
  const { pickTarget, targetLabel } = forLocale("ru");
  const target = pickTarget([], loadBirth(), null);
  expect(target).toEqual({ kind: "local" });
  expect(targetLabel(target, [], loadBirth())).toContain("31 марта 1993");
  // Buying is not a calculator submission and must not redirect to the result.
  expect(takeCalculationRequest()).toBeNull();
});

it("preserves an explicit saved matrix as the checkout target", () => {
  alignBirth(previous);
  const button = purchaseLink({ place: "report", birth: preview, matrixId: 42 });
  expect(button.props.href).toBe("/pay?m=42");
  button.props.onClick();
  expect(loadBirth()).toEqual(previous);
});

it("keeps the existing target for a generic purchase link", () => {
  alignBirth(previous);
  purchaseLink({ place: "header" }).props.onClick();
  expect(loadBirth()).toEqual(previous);
});
