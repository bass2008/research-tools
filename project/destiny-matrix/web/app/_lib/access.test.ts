import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: `arcana-sense.${process.env.NEXT_PUBLIC_SITE_LANG === "en" ? "com" : "ru"}`, "x-arcana-path": "/api/test" }),
  cookies: async () => ({ get: cookieGet, set: vi.fn() }),
}));

import { readAccess } from "./access";

// Ответ `/auth/me` в том виде, в каком его отдаёт api: права и признак открытой витрины лежат
// в `access`.
function me(rights: Record<string, unknown>) {
  const body = JSON.stringify({
    user: { email: "reader@example.com" },
    access: rights,
    matrices_used: 1,
  });
  // Читается через `res.text()`, а не `res.json()`: разбор с защитой от нечитаемого тела.
  return { ok: true, status: 200, text: async () => body } as unknown as Response;
}

describe("доступ к полному разбору", () => {
  beforeEach(() => {
    cookieGet.mockReset();
    cookieGet.mockReturnValue({ value: "token" });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("право на разовую дату открывает разбор", async () => {
    vi.mocked(fetch).mockResolvedValue(me({ scopes: ["single"], all_free: false }));
    const access = await readAccess();
    expect(access.paid).toBe(true);
    expect(access.allFree).toBe(false);
  });

  // Витрина без кассы прав не заводит намеренно (`api/app/access.py`): флаг снимается, и доступ
  // возвращается к оплаченному, а розданные права остались бы навсегда. Поэтому `scopes` там
  // пуст — и страница «Мой разбор» отвечала «матрица не выбрана» тому, у кого в кабинете лежала
  // открытая запись. Признак покупки при этом честно остаётся отрицательным: доступ приходит
  // с самой записью, а не выводится из прав.
  it("витрина без оплаты видна отдельным признаком, а не подделкой покупки", async () => {
    vi.mocked(fetch).mockResolvedValue(me({ scopes: [], all_free: true }));
    const access = await readAccess();
    expect(access.allFree, "витрина без кассы").toBe(true);
    expect(access.paid, "покупки не было, и признак не должен её выдумывать").toBe(false);
  });

  it("без прав и без открытой витрины разбор закрыт", async () => {
    vi.mocked(fetch).mockResolvedValue(me({ scopes: [], all_free: false }));
    const access = await readAccess();
    expect(access.paid).toBe(false);
    expect(access.allFree).toBe(false);
  });

  it("без куки доступа нет и апстрим не опрашивается", async () => {
    cookieGet.mockReturnValue(undefined);
    const access = await readAccess();
    expect(access.authenticated).toBe(false);
    expect(access.paid).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
