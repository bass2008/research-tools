import { afterEach, expect, it, vi } from "vitest";
import { acceptNotification } from "./notify";

afterEach(() => vi.unstubAllGlobals());

it("forwards the real callback host and preserves a refusal instead of acknowledging it", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
  vi.stubGlobal("fetch", fetcher);
  const response = await acceptNotification(new Request("https://arcana-sense.com/api/payments/notify/tbank", {
    method: "POST", body: "{}", headers: { "X-Arcana-Site-Origin": "https://arcana-sense.ru" },
  }), "/payments/notify/tbank");
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("FAIL");
  expect(new Headers(fetcher.mock.calls[0][1].headers).get("X-Arcana-Site-Origin")).toBe("https://arcana-sense.com");
});

it("acknowledges accepted RU notifications with exactly OK", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  const response = await acceptNotification(new Request("https://arcana-sense.ru/api/payments/notify/tbank", {
    method: "POST", body: "{}",
  }), "/payments/notify/tbank");
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("OK");
});
