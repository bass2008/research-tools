import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { GET, PATCH } from "../matrices/[id]/route";
import { POST } from "../auth/reset/apply/route";

describe("локализация отказов BFF до обращения к API", () => {
  it.each([GET, PATCH])("переводит невалидный номер матрицы", async (handle) => {
    const response = await handle(new Request("https://arcana-sense.com/api/matrices/bad", {
      headers: { "Accept-Language": "en", Cookie: "arcana_locale=ru" },
    }), { params: Promise.resolve({ id: "bad" }) });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: "Matrix not found",
      messages: { ru: "Матрица не найдена", en: "Matrix not found" } });
  });

  it.each([
    ["broken", "123", "The link is invalid"],
    ["x".repeat(20), "1", "The password has to be at least three characters long"],
  ])("переводит отказ сброса пароля", async (token, password, detail) => {
    const response = await POST(new Request("https://arcana-sense.com/api/auth/reset/apply", {
      method: "POST", headers: { "Content-Type": "application/json", "Accept-Language": "en" },
      body: JSON.stringify({ token, password }),
    }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.detail).toBe(detail);
    expect(body.messages.en).toBe(detail);
    expect(body.messages.ru).toMatch(/[А-Яа-я]/);
  });
});

import { POST as addMatrix } from "../admin/matrices/route";
import { POST as impersonate } from "../admin/impersonate/route";
import { POST as rebuild } from "../admin/report-rebuild/route";
import { GET as reportLink } from "../admin/report-link/route";
import { GET as adminUser } from "../admin/users/[id]/route";
import { POST as refund } from "../admin/payments/[id]/refund/route";

it.each(["en", "ru"])("admin BFF validation follows the requested locale: %s", async (locale) => {
  const request = (path: string, body?: object) => new Request(`https://arcana-sense.com/api/admin/${path}`, {
    method: body ? "POST" : "GET", headers: { "Accept-Language": locale, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const responses = await Promise.all([
    addMatrix(request("matrices", { user_id: 0 })),
    addMatrix(request("matrices", { user_id: 1, birth: "broken" })),
    impersonate(request("impersonate", { user_id: 0 })),
    rebuild(request("report-rebuild?job=bad")),
    reportLink(request("report-link?job=bad")),
    adminUser(request("users/bad"), { params: Promise.resolve({ id: "bad" }) }),
    refund(request("payments/bad/refund"), { params: Promise.resolve({ id: "bad" }) }),
  ]);
  for (const response of responses) {
    const body = await response.json();
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(body.detail).toBe(body.messages[locale]);
    expect(body.messages.ru).toMatch(/[А-Яа-я]/);
    expect(body.messages.en).not.toMatch(/[А-Яа-я]/);
  }
});
