import { afterEach, describe, expect, it, vi } from "vitest";
import { D } from "@/lib/i18n";
import { GET } from "../reports/file/route";
import { POST } from "../reports/pdf/route";

afterEach(() => vi.unstubAllGlobals());

describe("PDF download errors follow the active language", () => {
  it.each(["ru", "en"] as const)("translates missing, expired and unavailable links (%s)", async (locale) => {
    const request = (query = "") => new Request(`https://arcana-sense.com/api/reports/file${query}`, {
      headers: { "Accept-Language": locale },
    });
    const missing = await GET(request());
    expect(missing.status).toBe(400);
    expect(await missing.text()).toBe(D.bffErrors.noPass[locale]);
    expect(missing.headers.get("content-language")).toBe(locale);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("expired", { status: 403 })));
    const expired = await GET(request("?token=expired"));
    expect(expired.status).toBe(403);
    expect(await expired.text()).toBe(D.bffErrors.fileGone[locale]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const offline = await GET(request("?token=expired"));
    expect(offline.status).toBe(502);
    expect(await offline.text()).toBe(D.bffErrors.serviceDown[locale]);
  });

  it.each(["ru", "en"] as const)("document navigation uses the chosen language over browser preferences (%s)", async (locale) => {
    const response = await GET(new Request("https://arcana-sense.com/api/reports/file", {
      headers: { Cookie: `arcana_locale=${locale}`, "Accept-Language": locale === "en" ? "ru-RU" : "en-US", "Sec-Fetch-Mode": "navigate" },
    }));
    expect(await response.text()).toBe(D.bffErrors.noPass[locale]);
  });

  it("keeps the Russian domain Russian", async () => {
    const response = await GET(new Request("https://arcana-sense.ru/api/reports/file", {
      headers: { Cookie: "arcana_locale=en", "Accept-Language": "en", "Sec-Fetch-Mode": "navigate" },
    }));
    expect(await response.text()).toBe(D.bffErrors.noPass.ru);
  });

  it("preserves the PDF stream and attachment filename", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("%PDF-test", { headers: { "Content-Disposition": "attachment; filename=report.pdf" } }));
    vi.stubGlobal("fetch", fetch);
    const response = await GET(new Request("https://arcana-sense.com/api/reports/file?token=valid", { headers: { "Accept-Language": "en" } }));
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("report.pdf");
    expect(await response.text()).toBe("%PDF-test");
    expect(fetch.mock.calls[0][1].headers["Accept-Language"]).toBe("en");
  });

  it("returns both translations for an invalid PDF target", async () => {
    const response = await POST(new Request("https://arcana-sense.com/api/reports/pdf", {
      method: "POST", headers: { "Accept-Language": "en", "Content-Type": "application/json" }, body: JSON.stringify({ matrix_id: 0 }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ detail: D.bffErrors.badMatrix.en, messages: D.bffErrors.badMatrix });
  });
});
