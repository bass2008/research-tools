// Цели внешней Метрики. Дата рождения в параметры не попадает никогда: разрешены только
// код тарифа, раздел и год-десятилетие — ничего, по чему восстанавливается дата.
export type Goal = "calc" | "buy_click" | "pay_open" | "tariff_select" | "purchase"
  | "pdf_click";

export interface GoalParams {
  tariff?: string;
  section?: string;
  place?: string;
  decade?: number;
}

declare global {
  interface Window {
    ym?: (id: number, action: string, ...rest: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const FORBIDDEN = /(birth|date|дата|day|month|year|dob)/i;

// Осознанное исключение из SettingManager: Next.js подставляет публичный id в browser bundle
// во время сборки. Прямое имя переменной также проверяет production build gate.
const METRIKA_ID = Number(process.env.NEXT_PUBLIC_METRIKA_ID) || 0;

function clean(params?: GoalParams): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (FORBIDDEN.test(k)) continue;
    if (typeof v === "string" && /\d{4}-\d{2}-\d{2}/.test(v)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function metrikaId(): number {
  return METRIKA_ID;
}

export function track(goal: Goal, params?: GoalParams): void {
  if (typeof window === "undefined") return;
  const payload = clean(params);
  const id = metrikaId();
  try {
    if (id && window.ym) window.ym(id, "reachGoal", goal, payload);
  } catch {
    /* счётчик не должен ломать страницу */
  }
  (window.dataLayer = window.dataLayer ?? []).push(
    payload ? { event: goal, ...payload } : { event: goal },
  );
}

export function notBounce(): void {
  if (typeof window === "undefined") return;
  const id = metrikaId();
  try {
    if (id && window.ym) window.ym(id, "notBounce");
  } catch {
    /* см. выше */
  }
}
