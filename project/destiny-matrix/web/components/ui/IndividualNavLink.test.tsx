import { isValidElement } from "react";
import { expect, it, vi } from "vitest";
import { track } from "@/lib/analytics";
import IndividualNavLink from "./IndividualNavLink";

vi.mock("@/components/ui/LocaleProvider", () => ({ useLocale: () => "ru" }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

it("the header tab reports the click to Metrika", () => {
  const link = IndividualNavLink({});
  if (!isValidElement<{ href: string; onClick: () => void }>(link)) throw new Error("Expected a link");
  expect(link.props.href).toBe("/individual");
  link.props.onClick();
  expect(track).toHaveBeenCalledWith("individual_click", { place: "header" });
});
