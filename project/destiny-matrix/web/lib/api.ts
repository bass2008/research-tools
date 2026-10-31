import { reportBadFormat } from "./errors";
import { holdingList, type Holding } from "@/lib/holdings";
import { D } from "./i18n";
import { beginRetry, failureCause, waitForOnline, waitForRetry } from "./netwatch";

// Клиент к BFF (`web/app/api/**`), а не к api напрямую. Адрес всегда свой origin:
// токен лежит в httpOnly-куке, поэтому кросс-доменный базовый адрес её бы не отправил, а
// адрес апстрима в браузер не попадает вовсе.
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import type { Sex } from "./matrix";

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
  /** доступ по продуктам: `unlimited` — подписка открывает любые разборы продукта */
  products: Record<string, { unlimited: boolean }>;
  /** сводка прав для экранов (`access.holdings`) */
  holdings: Holding[];
}

/** Как открыта матрица: витриной без оплаты, куплена бессрочно, выдана без оплаты, открыта
 * подпиской или закрыта. `granted` отличается от `forever` намеренно: знак купленного владения
 * подарку не принадлежит, а `open` не принадлежит никому — он снимается вместе с флагом. */
export type MatrixAccess = "open" | "forever" | "granted" | "subscription" | "locked";

export interface MatrixListItem {
  id: number;
  birth: string;
  sex: Sex;
  created_at: string;
  title: string | null;
  access: MatrixAccess;
  /** до какого числа открыта по подписке; null — бессрочно или закрыта */
  access_until: string | null;
  /** открыта выданным правом, в том числе выданной подпиской */
  access_granted?: boolean;
}

/** Разбор любого продукта: продукт и введённые данные. */
export interface ReadingItem {
  id: number;
  product: string;
  inputs: Record<string, unknown>;
  /** у личного разбора — дата и пол, как в `MatrixListItem` */
  birth?: string;
  sex?: Sex;
  title: string | null;
  created_at: string;
  access: MatrixAccess;
  access_until: string | null;
  access_granted?: boolean;
  unlocked?: boolean;
}

/** Карточка сохранённой матрицы. Разделов здесь нет: разбор считает фронт. */
export interface MatrixCard extends MatrixListItem {
  unlocked: boolean;
}

/** Строка истории платежей. `tariff` — снимок на момент покупки, поэтому цена в истории не «плывёт». */
export interface PaymentItem {
  id: number;
  amount: number;
  tariff: { id?: string; name?: string; display_name?: string; price?: number; scope?: string[]; period_days?: number | null };
  matrix_id: number | null;
  /** какую дату открыл платёж: номер записи админу ничего не говорит */
  matrix?: MatrixListItem | null;
  /** разбор любого продукта, который открыл заказ */
  reading?: { id: number; product: string; title: string | null; birth?: string; sex?: "m" | "f" } | null;
  external_id: string;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  /** Состояние, вычисленное сервером: new | paid | refunded | failed | abandoned. Экраны его
   *  только показывают — раньше каждый собирал исход из отметок сам, и порядок проверок решал
   *  результат: возвращённый платёж выглядел оплаченным. */
  state?: "new" | "paid" | "refunded" | "failed" | "abandoned";
}

export type AdminUserSort = "id" | "email" | "matrices" | "payments" | "spent" | "access" | "last_seen_at" | "created_at";

/** Строка списка пользователей в админке. */
export interface AdminVisit {
  client_id: string;
  counter_id: number;
  site_origin: string;
  first_seen_at: string;
  last_seen_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  created_at: string;
  last_seen_at: string | null;
  is_admin: boolean;
  matrices: number;
  payments: number;
  /** уплачено всего, копейки */
  spent: number;
  scopes: string[];
  owned: number;
  /** сколько дат открыто без оплаты: выдал админ или промо */
  granted: number;
  until: string | null;
  rights: number;
  /** сводка прав (`access.holdings`): верхние поля выше — только про личный разбор */
  holdings?: Holding[];
}

export interface ReportJobItem {
  id: number;
  matrix_id: number;
  locale: Locale;
  status: "running" | "done" | "failed" | "expired";
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

export interface WorkerStatus {
  online: boolean;
  last_seen_at: string | null;
  offline_after: number;
}

export interface WorkTask {
  id: number;
  kind: string;
  status: "queued" | "signalled" | "done" | "failed";
  reading_id: number | null;
  reason: string | null;
  params: { keys?: string[]; response?: string };
  error: string | null;
  problems: string[];
  attempts: number;
  created_at: string;
  due_at: string;
  signalled_at: string | null;
  finished_at: string | null;
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
  log: Array<{
    payment: number; email: string; was: string; now?: string; paid?: boolean;
    error?: string
  }>;
}

export interface AdminPayment extends PaymentItem {
  user_id: number;
  email: string;
}

export interface ApplicationSetting {
  component: "api" | "browser" | "web-public" | "web-server";
  name: string;
  value: string;
  source: "environment" | "default" | "generated";
  sensitive: boolean;
  configured: boolean;
}

export interface ApplicationSettings {
  frontend: { group: "frontend"; items: ApplicationSetting[] };
  backend: { group: "backend"; items: ApplicationSetting[]; warnings?: string[] };
}

export interface AdminUserCard {
  user: AdminUser;
  matrices: MatrixListItem[];
  /** разборы всех продуктов */
  readings?: ReadingItem[];
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
  matrix: { id: number; birth?: string; sex?: "m" | "f"; title: string | null; product?: string } | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly locale: Locale = defaultLocale,
    readonly messages: Partial<Record<Locale, string>> = {},
  ) {
    super(message);
  }

  messageFor(locale: Locale): string {
    return this.messages[locale] ?? (locale === this.locale ? this.message : D.apiErrors.status[locale](this.status));
  }
}

export interface Pulse {
  at: string;
  memory: {
    total_mb: number; used_mb: number; percent: number;
    swap_total_mb: number; swap_used_mb: number; swap_percent: number;
  };
  cpu: {
    load1: number; load5: number; load15: number; cores: number;
    percent: number; window_seconds: number;
  };
  contours: {
    title: string; percent: number; memory_mb: number;
    items: { name: string; percent: number; memory_mb: number }[];
  }[];
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
  action: "login" | "register" | "reset" | "impersonate";
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

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {

  const API_BASE = "/api";
  const RETRY_SHORT = [1500];
  const RETRY_LONG = [1500, 3000, 6000, 12000, 20000, 30000, 30000];
  const OFFLINE_WAIT = 60_000;

  interface RequestOptions extends RequestInit {
    /** "long": the person waits on this action (sign-in), so keep trying for about two minutes. */
    retry?: "long";
  }

  // Only requests that are safe to repeat are retried: a lost answer to a payment must not start a second one.
  async function send(path: string, init: RequestOptions, headers: Record<string, string>): Promise<Response> {
    const { retry, ...rest } = init;
    const method = rest.method ?? "GET";
    const schedule = retry === "long" ? RETRY_LONG : method === "GET" ? RETRY_SHORT : [];
    let stopRetry: (() => void) | null = null;
    let offlineWaits = 0;
    try {
      for (let attempt = 0; ; ) {
        try {
          return await fetch(`${API_BASE}${path}`, { ...rest, credentials: "same-origin", headers: { ...headers, ...rest.headers } });
        } catch (error) {
          const cause = failureCause(error);
          const phrase = cause === "offline" ? D.apiErrors.noInternet : D.apiErrors.unreachable;
          if (cause === "aborted" || !schedule.length) throw new ApiError(phrase[L], 0, L, phrase);
          if (cause === "offline" && offlineWaits < 3) {
            offlineWaits += 1;
            stopRetry ??= beginRetry();
            if (!(await waitForOnline(OFFLINE_WAIT))) throw new ApiError(phrase[L], 0, L, phrase);
            continue;
          }
          if (attempt >= schedule.length) throw new ApiError(phrase[L], 0, L, phrase);
          stopRetry ??= beginRetry();
          await waitForRetry(schedule[attempt]);
          attempt += 1;
        }
      }
    } finally {
      stopRetry?.();
    }
  }

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": L };
    if (init.body) headers["Content-Type"] = "application/json";
    const method = init.method ?? "GET";
    const started = performance.now();
    const res = await send(path, init, headers);
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
      if (!parsed && res.status < 500) reportBadFormat(method, API_BASE + path, res.status, performance.now() - started);
      const detail =
        parsed && data && typeof data === "object" && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : res.status === 404
            ? D.apiErrors.missing[L]
            : D.apiErrors.status[L](res.status);
      const supplied = data && typeof data === "object" && "messages" in data ? data.messages : null;
      const messages: Partial<Record<Locale, string>> = {};
      if (supplied && typeof supplied === "object") {
        for (const locale of ["ru", "en"] as const) {
          const value = (supplied as Record<string, unknown>)[locale];
          if (typeof value === "string") messages[locale] = value;
        }
      }
      if (!parsed) {
        for (const locale of ["ru", "en"] as const) {
          messages[locale] = res.status === 404 ? D.apiErrors.missing[locale] : D.apiErrors.status[locale](res.status);
        }
      }
      throw new ApiError(detail, res.status, L, messages);
    }
    if (!parsed) {
      reportBadFormat(method, API_BASE + path, res.status, performance.now() - started);
      throw new ApiError(D.apiErrors.unexpected[L], res.status, L, D.apiErrors.unexpected);
    }
    return data as T;
  }

  function scopeList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === "string" && v.length > 0);
  }

  const api = {
    register: (email: string, password: string) =>
      request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),

    login: (email: string, password: string) =>
      request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }), retry: "long" }),

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
    /** null — гость: сессии нет или она истекла. */
    me: async (): Promise<MeResponse | null> => {
      const raw = await request<Record<string, unknown>>("/auth/me");
      if (!raw.user) return null;
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
        products: Object.fromEntries(Object.entries((rights.products ?? {}) as Record<string, Record<string, unknown>>)
          .map(([code, value]) => [code, { unlimited: value?.unlimited === true }])),
        holdings: holdingList(rights.holdings),
      };
    },

    matrices: () => request<{ items: MatrixListItem[] }>("/readings?product=personal"),

    /** Разборы кабинета: без продукта — все, с типом каждого. */
    readings: (product?: string) => request<{ items: ReadingItem[] }>(product ? `/readings?product=${encodeURIComponent(product)}` : "/readings"),

    renameReading: (id: number, title: string) =>
      request<ReadingItem>(`/readings/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),

    /** Сохранить разбор: дата уходит на сервер только по явному действию вошедшего человека. */
    saveReading: (product: string, inputs: unknown) =>
      request<ReadingItem>("/readings", { method: "POST", body: JSON.stringify({ product, inputs }) }),

    payments: () => request<{ items: PaymentItem[] }>("/payments"),

    admin: {
      users: (page = 1, pageSize = 10, sort: AdminUserSort = "last_seen_at", order: "asc" | "desc" = "desc") => {
        const q = new URLSearchParams({ page: String(page), page_size: String(pageSize), sort, order });
        return request<{ items: AdminUser[]; total: number; page: number; page_size: number }>(
          `/admin/users?${q.toString()}`,
        );
      },
      payments: () => request<{ items: AdminPayment[] }>("/admin/payments"),
      visits: (id: number) => request<{ items: AdminVisit[] }>(`/admin/users/${id}/visits`),
      user: (id: number) => request<AdminUserCard>(`/admin/users/${id}`),
      reports: (page = 1, pageSize = 10) => {
        const q = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
        return request<{
          items: AdminReportJob[]; running: number; failed: number;
          avg_seconds: number | null; total: number
        }>(
          `/admin/reports?${q.toString()}`,
        );
      },
      sweeps: () => request<{ items: SweepRun[] }>("/admin/sweeps"),
      tasks: (page = 1) => request<{ items: WorkTask[]; pending: number; total: number; worker: WorkerStatus }>(`/admin/tasks?page=${page}`),
      createTestTask: () => request<WorkTask>("/admin/tasks", { method: "POST", body: JSON.stringify({ kind: "test" }) }),
      deleteTask: (id: number) => request<{ ok: boolean }>(`/admin/tasks/${id}`, { method: "DELETE" }),
      retryTask: (id: number) => request<WorkTask>(`/admin/tasks/${id}/retry`, { method: "POST" }),
      pulse: () => request<Pulse>("/admin/pulse"),
      settings: () => request<ApplicationSettings>("/admin/settings"),
      /** Что станет с доступом после возврата: текст считает сервер по тем же правам, что кабинет. */
      refundPreview: (id: number) => request<{ outcome: string }>(`/admin/payments/${id}/refund-preview`),
      /** Вернуть платёж: снимает права заказа и пишет покупателю письмо. */
      refund: (id: number) =>
        request<{ ok: true; status: string; refunded_at: string | null }>(
          `/admin/payments/${id}/refund`,
          { method: "POST" },
        ),
      errors: () => request<{ items: ErrorRow[]; hour: number }>("/admin/errors"),

      /** Войти под пользователем: кука сессии меняется на его, админ становится обычным посетителем. */
      impersonate: (userId: number) =>
        request<{ user: User; authenticated: boolean }>("/admin/impersonate", {
          method: "POST",
          body: JSON.stringify({ user_id: userId }),
        }),

      /** Выдать матрицу без оплаты: в кабинете она открыта, но помечена как выданная. */
      addMatrix: (userId: number, birth: string, sex: Sex) =>
        request<MatrixListItem & { granted_now?: boolean }>("/admin/matrices", {
          method: "POST",
          body: JSON.stringify({ user_id: userId, birth, sex }),
        }),

      /** Выдать разбор любого продукта без оплаты: так принимают продукт на тестовом контуре. */
      addReading: (userId: number, product: string, inputs: Record<string, unknown>) =>
        request<ReadingItem & { granted_now?: boolean }>("/admin/readings", {
          method: "POST",
          body: JSON.stringify({ user_id: userId, product, inputs }),
        }),

      /** Выдать подписку без оплаты: все продукты на срок предложения `month`. */
      addSubscription: (userId: number) =>
        request<{ ok: true; already: boolean; until: string | null }>("/admin/subscription", {
          method: "POST",
          body: JSON.stringify({ user_id: userId }),
        }),

      /** Подписанная ссылка на чужой готовый PDF — проверить, что человек получил нужный файл. */
      reportLink: (jobId: number) =>
        request<{ url: string }>(`/admin/report-link?job=${jobId}`),

      reportRebuild: (jobId: number) =>
        request<{ job_id: number; status: string; size_bytes: number | null; seconds: number | null }>(
          `/admin/report-rebuild?job=${jobId}`, { method: "POST" }),

      securityAudit: (category: AuditCategory, page: number, pageSize: number) => {
        const q = new URLSearchParams({
          category,
          page: String(page),
          page_size: String(pageSize),
        });
        return request<SecurityAuditPage>(`/admin/security-audit?${q.toString()}`);
      },
      clearSecurityAudit: () =>
        request<{ removed: number }>("/admin/security-audit", { method: "DELETE" }),
    },

    // Дата уходит на сервер только по явному действию авторизованного пользователя:
    // «сохранить матрицу в кабинет». Анонимный расчёт остаётся в браузере.
    saveMatrix: (birth: string, sex: Sex, title?: string) =>
      request<MatrixCard>("/matrices", {
        method: "POST",
        body: JSON.stringify({ birth, sex, title }),
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
      target?: { matrixId?: number; birth?: string; sex?: "m" | "f"; readingId?: number; inputs?: unknown },
      provider?: string,
    ) =>
      request<PaymentResponse & { order_id: string; payment_url: string | null; status: string }>(
        "/payments/start",
        {
          method: "POST",
          body: JSON.stringify({
            tariff,
            provider,
            email,
            ...(target?.matrixId ? { matrix_id: target.matrixId } : {}),
            ...(target?.birth ? { birth: target.birth, sex: target.sex ?? "f" } : {}),
            ...(target?.readingId ? { reading_id: target.readingId } : {}),
            ...(target?.inputs ? { inputs: target.inputs } : {}),
          }),
        },
      ),

    paySync: (orderId: string) =>
      request<{
        ok: true; status: string;
        /** состояние, решённое сервером: экраны его не пересчитывают */
        state: "new" | "paid" | "refunded" | "failed" | "abandoned";
        paid: boolean; matrix_id: number | null; product?: string | null;
        /** куплена подписка, а не разбор */
        subscription?: boolean;
        until?: string | null;
        /** после возврата: что стало с доступом — текст сервера; открыт ли ещё разбор */
        outcome?: string;
        still_open?: boolean;
        payment_id: string;
        tariff: string;
      }>("/payments/sync", {
        method: "POST",
        body: JSON.stringify({ order_id: orderId }),
      }),

    payReceipt: (orderId: string) =>
      request<{
        ok: true; status: string;
        state: "new" | "paid" | "refunded" | "failed" | "abandoned";
        paid: boolean;
        /** чек без входа: разборы и кабинет не раскрывает */
        matrix_id?: null; product?: null;
        subscription: boolean;
        until: string | null;
        outcome?: string;
        payment_id: string;
        tariff: string;
      }>("/payments/receipt", {
        method: "POST",
        body: JSON.stringify({ order_id: orderId }),
      }),

    reportJobs: () =>
      request<{
        items: Array<{
          id: number; matrix_id: number; reading_id?: number; locale: Locale; status: string;
          size_bytes: number | null; seconds: number | null
        }>
      }>("/reports"),

    reportPdf: (readingId: number) =>
      request<{
        job_id: number; status: string; cached: boolean; url: string; size_bytes: number | null;
        seconds: number | null
      }>("/reports/pdf", {
        method: "POST",
        body: JSON.stringify({ reading_id: readingId }),
      }),

  };
  return { API_BASE, api };
});

// Compatibility for callers that explicitly use the deployment default.
export const { API_BASE, api } = forLocale(defaultLocale);
