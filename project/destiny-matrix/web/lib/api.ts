// Клиент к BFF (`web/app/api/**`), а не к api напрямую. Адрес всегда свой origin:
// токен лежит в httpOnly-куке, поэтому кросс-доменный базовый адрес её бы не отправил, а
// адрес апстрима в браузер не попадает вовсе.
import type { Sex } from "./matrix";

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

/** Карточка сохранённой матрицы. Разделов здесь нет: разбор считает фронт. */
export interface MatrixCard extends MatrixListItem {
  unlocked: boolean;
}

/** Строка истории платежей. `tariff` — снимок на момент покупки, поэтому цена в истории не «плывёт». */
export interface PaymentItem {
  id: number;
  amount: number;
  tariff: { id?: string; name?: string; price?: number; scope?: string[]; period_days?: number | null };
  matrix_id: number | null;
  /** какую дату открыл платёж: номер записи админу ничего не говорит */
  matrix?: MatrixListItem | null;
  external_id: string;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  /** Состояние, вычисленное сервером: new | paid | refunded | failed | abandoned. Экраны его
   *  только показывают — раньше каждый собирал исход из отметок сам, и порядок проверок решал
   *  результат: возвращённый платёж выглядел оплаченным. */
  state?: "new" | "paid" | "refunded" | "failed" | "abandoned";
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

export interface ReportJobItem {
  id: number;
  matrix_id: number;
  status: "running" | "done" | "failed";
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  /** сколько заняла печать; по нему видно, хватает ли машине процессора */
  seconds: number | null;
  size_bytes: number | null;
  error: string | null;
}

export interface AdminReportJob extends ReportJobItem {
  user_id: number;
  email: string;
}

export interface SweepRun {
  id: number;
  status: "running" | "done";
  checked: number;
  changed: number;
  seconds: number | null;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  log: Array<{ payment: number; email: string; was: string; now?: string; paid?: boolean;
               error?: string }>;
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
  /** какая дата открыта платежом — по данным сервера, а не по состоянию браузера */
  matrix_id: number | null;
  matrix: { id: number; birth: string; sex: "m" | "f"; title: string | null } | null;
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


export interface Pulse {
  at: string;
  memory: { total_mb: number; used_mb: number; percent: number };
  cpu: { load1: number; load5: number; load15: number; cores: number; percent: number };
  disk: { path: string; total_gb: number; free_gb: number; used_gb: number; percent: number };
  data_disk: { path: string; total_gb: number; free_gb: number; used_gb: number; percent: number };
  online: {
    people: number;
    tabs: number;
    robots: number;
    pages: { path: string; people: number; tabs: number }[];
  };
  print: { active: number; waiting: number; failures_hour: number };
  payments: { stuck: number };
  errors: { last10min: number; hour: number };
  crawlers: { bot: string; requests: number; mb: number }[] | null;
  version: string;
}

export interface ErrorRow {
  id: number;
  at: string;
  method: string;
  path: string;
  status: number;
  message: string;
  trace: string | null;
}

export type AuditCategory = "all" | "success" | "failed" | "throttled";

export interface SecurityAuditRow {
  id: number;
  at: string;
  action: "login" | "register" | "reset";
  outcome: "success" | "failed" | "throttled";
  email: string | null;
  ip: string | null;
}

export interface SecurityAuditPage {
  items: SecurityAuditRow[];
  total: number;
  page: number;
  page_size: number;
}

export const api = {
  register: (email: string, password: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  /** Ответ одинаков для существующей и неизвестной почты: форма не должна работать проверкой адресов. */
  resetRequest: (email: string) =>
    request<{ ok: true; sent: boolean }>("/auth/reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetApply: (token: string, password: string) =>
    request<AuthResponse>("/auth/reset/apply", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

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
    reports: () => request<{ items: AdminReportJob[]; running: number; failed: number;
                            avg_seconds: number | null }>("/admin/reports"),
    sweeps: () => request<{ items: SweepRun[] }>("/admin/sweeps"),
    pulse: () => request<Pulse>("/admin/pulse"),
    /** Вернуть платёж: снимает право, закрывает разбор и пишет покупателю письмо. */
    refund: (id: number) =>
      request<{ ok: true; status: string; refunded_at: string | null }>(
        `/admin/payments/${id}/refund`,
        { method: "POST" },
      ),
    errors: () => request<{ items: ErrorRow[]; hour: number }>("/admin/errors"),

    securityAudit: (category: AuditCategory, page: number, pageSize: number) => {
      const q = new URLSearchParams({
        category,
        page: String(page),
        page_size: String(pageSize),
      });
      return request<SecurityAuditPage>(`/admin/security-audit?${q.toString()}`);
    },
  },

  // Дата уходит на сервер только по явному действию авторизованного пользователя:
  // «сохранить матрицу в кабинет». Анонимный расчёт остаётся в браузере.
  saveMatrix: (birth: string, sex: Sex, title?: string) =>
    request<MatrixCard>("/matrices", {
      method: "POST",
      body: JSON.stringify({ birth, sex, title }),
    }),

  /** Подписать матрицу. Пустое имя возвращает подпись по умолчанию — дату. */
  renameMatrix: (id: number, title: string) =>
    request<MatrixListItem>(`/matrices/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  /** `matrixId` — какую сохранённую дату открыть; без него право ждёт следующую сохранённую. */
  payMock: (
    tariff: string,
    email: string,
    target?: { matrixId?: number; birth?: string; sex?: "m" | "f" },
  ) =>
    request<PaymentResponse>("/payments/mock", {
      method: "POST",
      body: JSON.stringify({
        tariff,
        email,
        ...(target?.matrixId ? { matrix_id: target.matrixId } : {}),
        ...(target?.birth ? { birth: target.birth, sex: target.sex ?? "f" } : {}),
      }),
    }),

  payStart: (
    tariff: string,
    email: string,
    target?: { matrixId?: number; birth?: string; sex?: "m" | "f" },
  ) =>
    request<PaymentResponse & { order_id: string; payment_url: string | null; status: string }>(
      "/payments/start",
      {
        method: "POST",
        body: JSON.stringify({
          tariff,
          email,
          ...(target?.matrixId ? { matrix_id: target.matrixId } : {}),
          ...(target?.birth ? { birth: target.birth, sex: target.sex ?? "f" } : {}),
        }),
      },
    ),

  paySync: (orderId: string) =>
    request<{ ok: true; status: string;
              /** состояние, решённое сервером: экраны его не пересчитывают */
              state: "new" | "paid" | "refunded" | "failed" | "abandoned";
              paid: boolean; matrix_id: number | null;
              payment_id: string }>("/payments/sync", {
      method: "POST",
      body: JSON.stringify({ order_id: orderId }),
    }),

  reportJobs: () =>
    request<{ items: Array<{ id: number; matrix_id: number; status: string;
                             size_bytes: number | null; seconds: number | null }> }>("/reports"),

  reportPdf: (matrixId: number) =>
    request<{ job_id: number; status: string; cached: boolean; url: string; size_bytes: number | null;
              seconds: number | null }>("/reports/pdf", {
      method: "POST",
      body: JSON.stringify({ matrix_id: matrixId }),
    }),

  lead: (email: string, source?: string) =>
    request<{ ok: true }>("/leads", { method: "POST", body: JSON.stringify({ email, source }) }),
};
