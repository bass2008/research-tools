// Доступ к платным разделам определяется здесь — на сервере, по httpOnly-куке. В браузер
// признак доступа не отдаётся и из JavaScript не читается: страница либо напечатана с
// разделами, либо без них.
//
// Каталог `_lib` приватный: App Router не делает из папок с подчёркиванием маршрутов.
import type { Tariff } from "@/lib/tariffs";

import { sessionToken, upstreamUrl } from "../api/_lib/upstream";

export interface SavedMatrix {
  id: number;
  birth: string;
  sex: "m" | "f";
  title: string | null;
  created_at?: string;
  /** запись уже открыта покупкой или подпиской: страница разбора выбирает такую первой */
  unlocked?: boolean;
}

export interface Access {
  /** кука есть и апстрим её принял */
  authenticated: boolean;
  email: string | null;
  /** виды доступа из действующих прав: single | matrix | all. Пусто — платных разделов нет */
  scopes: string[];
  /** есть хоть одно действующее право: разовое привязано к своей матрице */
  paid: boolean;
  /** право открывать любые даты */
  unlimited: boolean;
  /** до какого числа действует срочное право; null — бессрочно или прав нет */
  until: string | null;
  used: number;
  /** апстрим не ответил: доступа нет, но человеку нужно объяснить, почему */
  offline: boolean;
}

const NO_ACCESS: Access = {
  authenticated: false,
  email: null,
  scopes: [],
  paid: false,
  unlimited: false,
  until: null,
  used: 0,
  offline: false,
};

async function upstream(path: string, token: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const res = await fetch(upstreamUrl(path), {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, body: null };
      }
    }
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

function scopeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

export async function readAccess(): Promise<Access> {
  const token = await sessionToken();
  if (!token) return NO_ACCESS;

  const me = await upstream("/auth/me", token);
  if (!me.ok) {
    // 401 — кука мертва, всё остальное — апстрим молчит; и там и там платного не печатаем
    return { ...NO_ACCESS, offline: me.status !== 401 };
  }
  const raw = (me.body ?? {}) as Record<string, unknown>;
  const user = (raw.user ?? {}) as Record<string, unknown>;
  const rights = (raw.access ?? {}) as Record<string, unknown>;
  const scopes = scopeList(rights.scopes);
  return {
    authenticated: true,
    email: typeof user.email === "string" ? user.email : null,
    scopes,
    paid: scopes.length > 0,
    unlimited: raw.unlimited === true,
    until: typeof raw.until === "string" ? raw.until : null,
    used: Number(raw.matrices_used ?? 0),
    offline: false,
  };
}

/**
 * Открыт ли платный разбор именно этой матрицы. Решает апстрим: разовое право привязано к
 * матрице, и повторять здесь его правила означало бы держать две копии одной логики.
 */
export async function readMatrixUnlocked(id: number): Promise<boolean> {
  const token = await sessionToken();
  if (!token) return false;
  const res = await upstream(`/matrices/${id}`, token);
  return res.ok && (res.body as { unlocked?: unknown } | null)?.unlocked === true;
}

export interface PrintPage {
  id: number;
  birth: string;
  sex: "m" | "f";
  title: string | null;
  unlocked: boolean;
  plan: string;
}

/**
 * Страница печати: её открывает браузерный сервис, у которого куки владельца нет и быть не
 * должно. Вместо неё — пропуск на одну матрицу, живущий минуту.
 */
export async function readPrintPage(id: number, token: string): Promise<PrintPage | null> {
  const res = await upstream(`/reports/page/${id}?t=${encodeURIComponent(token)}`, "");
  if (!res.ok || !res.body || typeof res.body !== "object") return null;
  const row = res.body as Record<string, unknown>;
  const birth = String(row.birth ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  return {
    id: Number(row.id),
    birth,
    sex: row.sex === "f" ? "f" : "m",
    title: typeof row.title === "string" ? row.title : null,
    unlocked: row.unlocked === true,
    plan: typeof row.plan === "string" ? row.plan : "разбор",
  };
}

/** Как назвать доступ в отчёте: имя тарифа берём из базы, а не из кода. */
export function planLabel(access: Access, tariffs: Tariff[], unlocked: boolean): string {
  if (access.unlimited) {
    return tariffs.find((t) => t.scope.includes("all"))?.name ?? "без ограничений";
  }
  if (unlocked) {
    return tariffs.find((t) => !t.scope.includes("all"))?.name ?? "разовый разбор";
  }
  return "бесплатные разделы";
}

/**
 * Сохранённые матрицы владельца куки. Список — единственный источник дат: чужой `id` в него не
 * попадает, поэтому проверка «моя ли это матрица» сводится к поиску по нему.
 */
export async function readSavedMatrices(): Promise<SavedMatrix[]> {
  const token = await sessionToken();
  if (!token) return [];
  const res = await upstream("/matrices", token);
  if (!res.ok) return [];
  const items = (res.body as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const out: SavedMatrix[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = Number(row.id);
    const birth = String(row.birth ?? "");
    const sex = row.sex === "f" ? "f" : "m";
    if (!Number.isInteger(id) || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) continue;
    out.push({
      id,
      birth,
      sex,
      title: typeof row.title === "string" ? row.title : null,
      created_at: typeof row.created_at === "string" ? row.created_at : undefined,
      unlocked: row.access !== "locked",
    });
  }
  // самая свежая первой: этот порядок видит кабинет и списки выбора даты
  return out.sort((a, b) => b.id - a.id);
}

export function pickMatrix(saved: SavedMatrix[], wanted?: string | string[]): SavedMatrix | null {
  const raw = Array.isArray(wanted) ? wanted[0] : wanted;
  // адрес назвал запись — показываем только её. Нечисловое значение раньше проваливалось
  // в «самую свежую», и страница молча показывала не то, что стоит в адресе.
  if (raw !== undefined && raw !== "") {
    return /^\d+$/.test(raw) ? saved.find((m) => m.id === Number(raw)) ?? null : null;
  }
  // без параметра открываем оплаченную: человек заплатил за одну дату, а список отсортирован
  // по свежести, и «Мой разбор» показывал последнюю сохранённую
  return saved.find((m) => m.unlocked) ?? saved[0] ?? null;
}
