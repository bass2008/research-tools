import { afterEach, describe, expect, it, vi } from "vitest";

const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  cookieGet.mockReset();
});

describe("единый BFF-снимок настроек", () => {
  it("не показывает frontend-настройки без подтверждённой admin-сессии", async () => {
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ detail: "Нужен вход: сессии нет" });
  });

  it("объединяет frontend и backend только после ответа API", async () => {
    cookieGet.mockReturnValue({ value: "admin-session" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      group: "backend",
      items: [{ component: "api", name: "JWT_SECRET", value: "abcdef…", source: "environment",
                sensitive: true, configured: true }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.frontend.group).toBe("frontend");
    expect(body.frontend.items.some((row: { name: string }) => row.name === "NEXT_PUBLIC_SITE_URL")).toBe(true);
    expect(body.backend.items[0].value).toBe("abcdef…");
  });
});
