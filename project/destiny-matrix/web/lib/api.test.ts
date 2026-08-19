import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api } from "./api";

function stubFetch(status: number, body: string, contentType = "application/json") {
  const spy = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(body, { status, headers: { "Content-Type": contentType } }),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("клиент API", () => {
  it("отдаёт данные при успехе", async () => {
    stubFetch(200, JSON.stringify({ ok: true, payment_id: "p1", token: "t", user: { id: 1, email: "a@b.c" }, autoregistered: true }));
    const res = await api.payMock("full", "a@b.c");
    expect(res.payment_id).toBe("p1");
  });

  it("не падает на не-JSON теле: 404-страница даёт ApiError, а не SyntaxError", async () => {
    // Пока api не поднят, /api/* отдаёт HTML-страницу 404. Раньше здесь падал
    // JSON.parse, и форма оплаты теряла честную ветку «почту сохранили».
    stubFetch(404, "<!DOCTYPE html><html><body>404</body></html>", "text/html");
    await expect(api.payMock("full", "a@b.c")).rejects.toBeInstanceOf(ApiError);
    await expect(api.payMock("full", "a@b.c")).rejects.toMatchObject({ status: 404 });
  });

  it("детализирует ошибку из поля detail", async () => {
    stubFetch(402, JSON.stringify({ detail: "лимит тарифа исчерпан" }));
    await expect(api.matrices()).rejects.toMatchObject({
      status: 402,
      message: "лимит тарифа исчерпан",
    });
  });

  it("успешный ответ с мусором в теле тоже даёт ApiError", async () => {
    stubFetch(200, "not json at all", "text/plain");
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
  });

  it("недоступная сеть превращается в ApiError со статусом 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(api.login("a@b.c", "12345678")).rejects.toMatchObject({ status: 0 });
  });

  it("права читаются из access, а не из поля тарифа", async () => {
    // Поля tariff в /auth/me больше нет: доступ описывают действующие права. Пока фронт читал
    // raw.tariff, у оплатившего месяц кабинет показывал «не оплачен», а разбор — шесть разделов.
    stubFetch(200, JSON.stringify({
      user: { id: 1, email: "a@b.c" },
      access: { scopes: ["single", "matrix", "all"], rights: [] },
      can_store: true,
      unlimited: true,
      until: "2026-09-12T00:00:00",
      matrices_used: 3,
      matrices_limit: null,
    }));
    const me = await api.me();
    expect(me.scopes).toEqual(["single", "matrix", "all"]);
    expect(me.can_store).toBe(true);
    expect(me.unlimited).toBe(true);
    expect(me.until).toBe("2026-09-12T00:00:00");
    expect(me.matrices_used).toBe(3);
    expect(me.matrices_limit).toBeNull();
  });

  it("лимит хранения приходит числом: слот даёт каждая покупка разбора", async () => {
    stubFetch(200, JSON.stringify({
      user: { id: 1, email: "a@b.c" },
      access: { scopes: ["single"], rights: [] },
      can_store: false,
      unlimited: false,
      until: null,
      matrices_used: 2,
      matrices_limit: 3,
    }));
    const me = await api.me();
    expect(me.matrices_limit).toBe(3);
  });

  it("без прав scope пустой, а сроков нет", async () => {
    stubFetch(200, JSON.stringify({ user: { id: 2, email: "n@b.c" }, access: { scopes: [] } }));
    const me = await api.me();
    expect(me.scopes).toEqual([]);
    expect(me.unlimited).toBe(false);
    expect(me.until).toBeNull();
  });

  it("дата рождения уходит только в сохранение матрицы", async () => {
    const spy = stubFetch(200, JSON.stringify({ ok: true }));
    await api.lead("a@b.c", "pay");
    const [, init] = spy.mock.calls[0];
    expect(JSON.stringify(init ?? {})).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
