// BFF: единственный путь браузера к api. Адрес апстрима — серверная переменная
// API_INTERNAL_URL (в бандл не попадает, префикса NEXT_PUBLIC_ у неё нет намеренно), токен
// живёт в httpOnly-куке и в JS недоступен.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "destiny_session";

// срок как у JWT в api (jwt_ttl_days = 30)
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

const DEFAULT_UPSTREAM = "http://127.0.0.1:8010";

// Кука сессии с флагом secure по http не ставится вовсе — в проде это правильно, но в
// контейнере, который слушают на http://localhost, вход просто перестаёт работать. Поэтому
// флаг отделён от NODE_ENV: SESSION_COOKIE_SECURE=0 разрешает http, на домене с TLS не трогать.
const SESSION_SECURE =
  process.env.SESSION_COOKIE_SECURE !== undefined
    ? process.env.SESSION_COOKIE_SECURE === "1" || process.env.SESSION_COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";

/** Адрес апстрима без хвостового `/api`: он дописывается сам. */
export function upstreamBase(): string {
  const raw = process.env.API_INTERNAL_URL ?? process.env.API_ORIGIN ?? DEFAULT_UPSTREAM;
  return raw.replace(/\/+$/, "").replace(/\/api$/, "");
}

export function upstreamUrl(path: string): string {
  return `${upstreamBase()}/api${path}`;
}

export async function sessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export function json(body: unknown, status = 200): NextResponse {
  // no-store обязателен: иначе признак доступа и почта пользователя осядут в кеше браузера
  // или промежуточного прокси и уедут следующему посетителю.
  return NextResponse.json(body as Record<string, unknown>, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

function setSession(res: NextResponse, token: string): void {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: SESSION_SECURE,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function dropSession(res: NextResponse): NextResponse {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: SESSION_SECURE,
    path: "/",
    maxAge: 0,
  });
  return res;
}

interface ForwardOptions {
  method?: "GET" | "POST" | "PATCH";
  /** подставить Authorization из куки; без куки — 401 без обращения к апстриму */
  auth?: boolean;
  body?: unknown;
  /** забрать token из ответа в куку и убрать его из тела */
  capture?: boolean;
  agent?: string | null;
}

/** Проксировать запрос в api. Тело всегда JSON, ошибки — в форме контракта `{detail}`. */
export async function forward(path: string, opts: ForwardOptions = {}): Promise<NextResponse> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };

  if (opts.auth) {
    const token = await sessionToken();
    if (!token) return json({ detail: "Нужен вход: сессии нет" }, 401);
    headers.Authorization = `Bearer ${token}`;
  }
  // User-Agent пробрасываем только там, где он нужен: по нему api отличает роботов от людей
  // в счётчике присутствия. Собственный агент node-сервера сделал бы роботами всех.
  if (opts.agent) headers["User-Agent"] = opts.agent;
  let payload: string | undefined;
  if (opts.body !== undefined) {
    payload = JSON.stringify(opts.body);
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(upstreamUrl(path), { method, headers, body: payload, cache: "no-store" });
  } catch {
    return json({ detail: "Сервис недоступен: сервер приложения не отвечает." }, 502);
  }

  // апстрим может ответить не-JSON (HTML 404 прокси, 502 балансировщика) — наверх всё равно
  // уходит JSON, иначе клиент не отличит отказ сервера от своей ошибки
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return json(
        { detail: res.ok ? "Сервер ответил в неожиданном формате." : `Сервер ответил ошибкой ${res.status}.` },
        res.ok ? 502 : res.status,
      );
    }
  }

  if (!opts.capture || !res.ok || !isRecord(data)) return json(data, res.status);

  const { token, ...rest } = data as Record<string, unknown> & { token?: unknown };
  const out = json({ ...rest, authenticated: typeof token === "string" && token.length > 0 }, res.status);
  if (typeof token === "string" && token) setSession(out, token);
  return out;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
