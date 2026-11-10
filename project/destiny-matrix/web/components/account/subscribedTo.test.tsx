import { describe, expect, it } from "vitest";
import { subscribedTo, type Session } from "./useSession";

const session = (status: Session["status"], subscribed: string[]) => ({ status, subscribed }) as unknown as Session;

describe("подписка на время перепроверки сессии", () => {
  it("остаётся известной, пока сессия перепроверяется при возврате во вкладку", () => {
    expect(subscribedTo(session("user", ["personal"]))).toBe(true);
    expect(subscribedTo(session("loading", ["personal"]))).toBe(true);
  });

  it("не появляется без подтверждения сервера", () => {
    expect(subscribedTo(session("loading", []))).toBe(false);
    expect(subscribedTo(session("offline", []))).toBe(false);
    expect(subscribedTo(session("guest", []))).toBe(false);
  });
});
