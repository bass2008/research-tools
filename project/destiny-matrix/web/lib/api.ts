// Клиент к BFF (`web/app/api/**`), а не к api напрямую. Адрес всегда свой origin:
// токен лежит в httpOnly-куке, поэтому кросс-доменный базовый адрес её бы не отправил, а
// адрес апстрима в браузер не попадает вовсе.
import type { Matrix, Sex } from "./matrix";
import type { SectionOut } from "./sections";

export const API_BASE = "/api";

export interface User {
  id: number;
  email: string;
}

export interface AuthResponse {
  authenticated: boolean;
  user: User;
}

/** Что открыто — решают действующие права, поле тарифа у пользователя не хранится. */
export interface MeResponse {
  user: User;
  /** виды доступа: single | matrix | all */
  scopes: string[];
  can_store: boolean;
  unlimited: boolean;
  /** ближайшая дата окончания срочного права; null — бессрочно или прав нет */
  until: string | null;
  matrices_used: number;
  /** сколько дат можно держать в кабинете; null — без ограничения */
  matrices_limit: number | null;
  /** сколько дат куплено бессрочно — покупка и подписка бывают одновременно */
  owned: number;
  /** доступна ли админка: список админских почт живёт в конфиге апстрима */
  is_admin: boolean;
}

export interface MatrixResponse {
  birth: string;
  sex: Sex;
  unlocked: boolean;
  matrix: Matrix;
  sections: SectionOut[];
}

/** Как открыта матрица: куплена бессрочно, открыта подпиской или закрыта. */
export type MatrixAccess = "forever" | "subscription" | "locked";

export interface MatrixListItem {
  id: number;
  birth: string;
  sex: Sex;
  created_at: string;
  title: string | null;
  access: MatrixAccess;
  /** до какого числа открыта по подписке; null — бессрочно или закрыта */
  access_until: string | null;
}

/** Строка истории платежей. `tariff` — снимок на момент покупки, поэтому цена в истории не «плывёт». */
export interface PaymentItem {
  id: number;
  amount: number;
  tariff: { id?: string; name?: string; price?: number; scope?: string[]; period_days?: number | null };
  matrix_id: number | null;
  external_id: string;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
}

/** Строка списка пользователей в админке. */
export interface AdminUser {
  id: number;
  email: string;
  created_at: string;
  is_admin: boolean;
  matrices: number;
  payments: number;
  /** уплачено всего, копейки */
  spent: number;
  scopes: string[];
  owned: number;
  until: string | null;
  rights: number;
}

export interface AdminPayment extends PaymentItem {
  user_id: number;
  email: string;
}

export interface AdminUserCard {
  user: AdminUser;
  matrices: MatrixListItem[];
  payments: PaymentItem[];
  rights: Array<{
    id: number;
    scope: string[];
    matrix_id: number | null;
    starts_at: string;
    expires_at: string | null;
    revoked_at: string | null;
    note: string | null;
  }>;
}

export interface PaymentResponse {
  ok: true;
  payment_id: string;
  user: User;
  autoregistered: boolean;
  /** true — BFF получил токен и поставил куку; false — тариф начислен владельцу почты */
  authenticated: boolean;
  requires_login?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init?.body) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "same-origin",
      headers: { ...headers, ...init?.headers },
    });
  } catch {
    throw new ApiError("Сервер не отвечает. Попробуйте позже.", 0);
  }
  // Тело может быть не JSON: пока api не поднят, на /api/* приходит HTML-страница 404.
  // Ронять здесь исключение нельзя — иначе вызывающий не отличит отказ сервера от своей ошибки
  // и потеряет уже собранную почту.
  const text = await res.text();
  let data: unknown = null;
  let parsed = true;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      parsed = false;
    }
  }
  if (!res.ok) {
    const detail =
      parsed && data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : res.status === 404
          ? "Сервис пока недоступен."
          : `Сервер ответил ошибкой ${res.status}.`;
    throw new ApiError(detail, res.status);
  }
  if (!parsed) throw new ApiError("Сервер ответил в неожиданном формате.", res.status);
  return data as T;
}

function scopeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

export const api = {
  register: (email: string, password: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  // Признак доступа берётся только отсюда: в localStorage он не хранится, а лишь кешируется
  // для мгновенной отрисовки (см. lib/storage.ts).
  me: async (): Promise<MeResponse> => {
    const raw = await request<Record<string, unknown>>("/auth/me");
    const rights = (raw.access ?? {}) as Record<string, unknown>;
    return {
      user: raw.user as User,
      scopes: scopeList(rights.scopes),
      can_store: raw.can_store === true,
      unlimited: raw.unlimited === true,
      until: typeof raw.until === "string" ? raw.until : null,
      matrices_used: Number(raw.matrices_used ?? 0),
      matrices_limit: raw.matrices_limit === null || raw.matrices_limit === undefined
        ? null
        : Number(raw.matrices_limit),
      owned: Number(raw.owned ?? 0),
      is_admin: raw.is_admin === true,
    };
  },

  matrices: () => request<{ items: MatrixListItem[] }>("/matrices"),

  payments: () => request<{ items: PaymentItem[] }>("/payments"),

  admin: {
    users: () => request<{ items: AdminUser[] }>("/admin/users"),
    payments: () => request<{ items: AdminPayment[] }>("/admin/payments"),
    user: (id: number) => request<AdminUserCard>(`/admin/users/${id}`),
  },

  // Дата уходит на сервер только по явному действию авторизованного пользователя:
  // «сохранить матрицу в кабинет». Анонимный расчёт остаётся в браузере.
  saveMatrix: (birth: string, sex: Sex, title?: string) =>
    request<MatrixResponse & { id: number }>("/matrices", {
      method: "POST",
      body: JSON.stringify({ birth, sex, title }),
    }),

  matrix: (id: number) => request<MatrixResponse>(`/matrices/${id}`),

  /** Подписать матрицу. Пустое имя возвращает подпись по умолчанию — дату. */
  renameMatrix: (id: number, title: string) =>
    request<MatrixListItem>(`/matrices/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  /** `matrixId` — какую сохранённую дату открыть; без него право ждёт следующую сохранённую. */
  payMock: (tariff: string, email: string, matrixId?: number) =>
    request<PaymentResponse>("/payments/mock", {
      method: "POST",
      body: JSON.stringify({ tariff, email, ...(matrixId ? { matrix_id: matrixId } : {}) }),
    }),

  lead: (email: string, source?: string) =>
    request<{ ok: true }>("/leads", { method: "POST", body: JSON.stringify({ email, source }) }),
};
