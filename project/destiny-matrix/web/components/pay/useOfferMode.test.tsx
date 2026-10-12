import { afterEach, expect, it, vi } from "vitest";
import { useOfferMode } from "./useOfferMode";

const state = vi.hoisted(() => ({ free: false, session: { status: "guest", subscribed: [] as string[] } }));
vi.mock("@/lib/access", () => ({ get ALL_FREE() { return state.free; } }));
vi.mock("@/components/account/useSession", async (original) => ({
  ...await original<typeof import("@/components/account/useSession")>(),
  useSession: () => state.session,
}));

afterEach(() => {
  state.free = false;
  state.session = { status: "guest", subscribed: [] };
});

it("sells to a guest and to a buyer of one reading", () => {
  expect(useOfferMode()).toBe("sell");
  state.session = { status: "user", subscribed: [] };
  expect(useOfferMode("pair")).toBe("sell");
});

it("offers nothing to a subscriber of the product", () => {
  state.session = { status: "user", subscribed: ["personal", "pair"] };
  expect(useOfferMode()).toBe("subscription");
  expect(useOfferMode("pair")).toBe("subscription");
});

it("keeps selling a product the subscription does not cover", () => {
  state.session = { status: "user", subscribed: ["personal"] };
  expect(useOfferMode("pair")).toBe("sell");
});

it("opens everything on a free showcase", () => {
  state.free = true;
  expect(useOfferMode()).toBe("free");
});
