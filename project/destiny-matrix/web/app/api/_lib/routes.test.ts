import { D, L } from "@/lib/i18n";
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailProblem } from "@/lib/email";
import { emailProblemMessage } from "@/lib/email";

const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet, set: vi.fn() }),
}));

import { credentials, payment } from "./routes";

interface Corpus {
  valid: string[];
  invalid: Array<{ value: string; problem: EmailProblem }>;
  normalize: Array<{ raw: string; value: string }>;
}

const CORPUS: Corpus = JSON.parse(
  readFileSync(path.join(__dirname, "..", "..", "..", "..", "spec", "email-cases.json"), "utf8"),
);

let upstream: ReturnType<typeof vi.fn>;

function post(body: unknown): Request {
  return new Request("https://arcana-sense.ru/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function sentBody(): Record<string, unknown> {
  const [, init] = upstream.mock.calls[0];
  return JSON.parse(String((init as RequestInit).body));
}

beforeEach(() => {
  upstream = vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, user: { id: 1, email: "user@mail.ru" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", upstream);
  cookieGet.mockReturnValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cookieGet.mockReset();
});

describe("BFF: регистрация и вход", () => {
  it("пропускает нормальный адрес в апстрим", async () => {
    const res = await credentials(post({ email: "user@mail.ru", password: "secret" }), "register");
    expect(res.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
    expect(sentBody().email).toBe("user@mail.ru");
  });

  for (const { value, problem } of CORPUS.invalid) {
    it(`не пускает в апстрим ${JSON.stringify(value.slice(0, 30))}`, async () => {
      const res = await credentials(post({ email: value, password: "secret" }), "register");
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ detail: emailProblemMessage(problem) });
      expect(upstream).not.toHaveBeenCalled();
    });
  }

  for (const value of CORPUS.valid) {
    it(`пропускает ${value}`, async () => {
      const res = await credentials(post({ email: value, password: "secret" }), "login");
      expect(res.status).toBe(200);
      expect(upstream).toHaveBeenCalledOnce();
    });
  }

  it("нормализует адрес до отправки: апстрим видит уже приведённый", async () => {
    for (const { raw, value } of CORPUS.normalize) {
      if (!value) continue;
      upstream.mockClear();
      await credentials(post({ email: raw, password: "secret" }), "register");
      expect(sentBody().email, `сырое ${JSON.stringify(raw)}`).toBe(value);
    }
  });

  it("отказ по почте приходит раньше отказа по паролю", async () => {
    const res = await credentials(post({ email: "user.@mail.ru", password: "1" }), "register");
    expect(await res.json()).toEqual({
      detail: D.emailErrors["local-dot-end"][L],
    });
  });

  it("отказ по формату не выдаёт себя за занятую почту", async () => {
    // 400 на регистрации означает «эта почта уже зарегистрирована», и экран оплаты по нему
    // молча пробует вход. Битый адрес обязан приходить другим кодом.
    for (const { value } of CORPUS.invalid) {
      const res = await credentials(post({ email: value, password: "secret" }), "register");
      expect(res.status, value).not.toBe(400);
    }
  });

  it("почты нет вовсе — просит ввести", async () => {
    const res = await credentials(post({ password: "secret" }), "register");
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ detail: D.emailErrors.empty[L] });
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe("BFF: платёж", () => {
  const good = { tariff: "single", email: "user@mail.ru", birth: "1993-03-31", sex: "f" };

  it("пропускает нормальный адрес", async () => {
    const res = await payment(post(good), "/payments/start");
    expect(res.status).toBe(200);
    expect(sentBody().email).toBe("user@mail.ru");
  });

  for (const { value, problem } of CORPUS.invalid) {
    it(`деньги не начинаются на ${JSON.stringify(value.slice(0, 30))}`, async () => {
      const res = await payment(post({ ...good, email: value }), "/payments/start");
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ detail: emailProblemMessage(problem) });
      expect(upstream).not.toHaveBeenCalled();
    });
  }

  it("нормализованный адрес доезжает до апстрима", async () => {
    await payment(post({ ...good, email: " <User@Mail.RU> " }), "/payments/start");
    expect(sentBody().email).toBe("user@mail.ru");
  });

  it("проверка почты идёт раньше проверки тарифа", async () => {
    const res = await payment(post({ ...good, tariff: "ПЛОХОЙ", email: "user.@mail.ru" }),
                              "/payments/start");
    expect(await res.json()).toEqual({
      detail: D.emailErrors["local-dot-end"][L],
    });
  });
});
