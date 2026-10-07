import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, forLocale } from "./api";

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
  it("переводит полученную ошибку без повторения запроса", async () => {
    const messages = { ru: "Неверная почта или пароль", en: "Wrong email or password" };
    const request = stubFetch(401, JSON.stringify({ detail: messages.ru, messages }));
    const error = await forLocale("ru").api.login("user@example.ru", "bad").catch((err) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.messageFor("en")).toBe(messages.en);
    expect(error.messageFor("ru")).toBe(messages.ru);
    expect(request).toHaveBeenCalledOnce();
  });

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

  it("недоступная сеть превращается в ApiError со статусом 0, оплата не повторяется", async () => {
    const request = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", request);
    const error = await forLocale("ru").api.payMock("full", "a@b.c").catch((err) => err);
    expect(error).toMatchObject({ status: 0 });
    expect(error.messageFor("ru")).toBe("Сайт сейчас не отвечает. Попробуйте ещё раз через минуту.");
    expect(request).toHaveBeenCalledOnce();
  });

  it("без интернета говорит про связь, а не про сайт", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    const error = await forLocale("ru").api.payMock("full", "a@b.c").catch((err) => err);
    expect(error.messageFor("ru")).toBe("Нет подключения к интернету. Проверьте связь и попробуйте ещё раз.");
  });

  it("чтение повторяется один раз, если сайт не ответил", async () => {
    vi.useFakeTimers();
    const request = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    const pending = api.matrices();
    await vi.advanceTimersByTimeAsync(1500);
    await expect(pending).resolves.toEqual({ items: [] });
    expect(request).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("вход ждёт возврата связи около двух минут, а не сдаётся сразу", async () => {
    vi.useFakeTimers();
    const request = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: 1, email: "a@b.c" } }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    const pending = api.login("a@b.c", "12345678");
    await vi.advanceTimersByTimeAsync(1500 + 3000 + 6000);
    await expect(pending).resolves.toMatchObject({ user: { id: 1 } });
    expect(request).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it("гость — не ошибка: пустой user превращается в null", async () => {
    stubFetch(200, JSON.stringify({ user: null }));
    await expect(api.me()).resolves.toBeNull();
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
    const me = (await api.me())!;
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
    const me = (await api.me())!;
    expect(me.matrices_limit).toBe(3);
  });

  it("без прав scope пустой, а сроков нет", async () => {
    stubFetch(200, JSON.stringify({ user: { id: 2, email: "n@b.c" }, access: { scopes: [] } }));
    const me = (await api.me())!;
    expect(me.scopes).toEqual([]);
    expect(me.unlimited).toBe(false);
    expect(me.until).toBeNull();
  });

});
