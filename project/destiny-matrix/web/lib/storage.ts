// Дата рождения живёт только в браузере: sessionStorage, никогда не в URL и не в аналитике.
// Токена здесь нет намеренно: сессия — httpOnly-кука, которую ставит BFF, из JS она не читается.
import type { Sex } from "./matrix";

const BIRTH_KEY = "destiny.birth";
const CALCULATION_REQUEST_KEY = "destiny.calculation-request";
const TARIFF_CACHE_KEY = "destiny.tariff-cache";
const LEAD_KEY = "destiny.lead";

// старые ключи: доступ открывался строкой в localStorage, теперь их надо забыть
const LEGACY_KEYS = ["destiny.token", "destiny.unlocked"];

export interface StoredBirth {
  birth: string;
  sex: Sex;
}

export interface StoredLead {
  email: string;
  tariff?: string;
  at: number;
}

// Запрет на хранилище (приватный режим, «блокировать данные сайтов») раньше означал, что
// дату негде удержать: /pay не видел её и требовал ввести заново — купить было нельзя.
// Память модуля живёт столько же, сколько вкладка, и наружу так же не уходит.
let memory: StoredBirth | null = null;
// Одноразовая отметка отличается от самой сохранённой даты: по ней страница понимает, что
// человек только что нажал «Рассчитать», а не просто вернулся на главную со старой датой.
let calculationRequest: StoredBirth | null = null;

/** Дата поменялась в одной форме — об этом узнают все формы страницы. */
export const BIRTH_EVENT = "destiny:birth";

function announce(v: StoredBirth | null): void {
  try {
    window.dispatchEvent(new CustomEvent(BIRTH_EVENT, { detail: v }));
  } catch {
    /* сервер или старый браузер — синхронизировать нечего */
  }
}

export function saveBirth(v: StoredBirth): void {
  memory = v;
  calculationRequest = v;
  try {
    sessionStorage.setItem(BIRTH_KEY, JSON.stringify(v));
    // Нужна и между страницами: форма в энциклопедии сохраняет дату, затем открывает главную.
    sessionStorage.setItem(CALCULATION_REQUEST_KEY, JSON.stringify(v));
  } catch {
    /* приватный режим: дата остаётся в памяти вкладки */
  }
  announce(v);
}

/** Забрать одноразовый запрос расчёта. Купленная дата по нему может сразу открыть серверный
 * полный разбор; обычное возвращение на главную автоматической навигации не вызывает. */
export function takeCalculationRequest(): StoredBirth | null {
  let stored: StoredBirth | null = null;
  try {
    const raw = sessionStorage.getItem(CALCULATION_REQUEST_KEY);
    sessionStorage.removeItem(CALCULATION_REQUEST_KEY);
    if (raw) {
      const value = JSON.parse(raw) as StoredBirth;
      if (typeof value?.birth === "string" && (value.sex === "m" || value.sex === "f")) {
        stored = value;
      }
    }
  } catch {
    /* приватный режим: остаётся память модуля */
  }
  const pending = stored ?? calculationRequest;
  calculationRequest = null;
  return pending;
}

export function loadBirth(): StoredBirth | null {
  try {
    const raw = sessionStorage.getItem(BIRTH_KEY);
    if (!raw) return memory;
    const v = JSON.parse(raw) as StoredBirth;
    if (typeof v?.birth !== "string" || (v.sex !== "m" && v.sex !== "f")) return null;
    return v;
  } catch {
    return memory;
  }
}

export function clearBirth(): void {
  memory = null;
  calculationRequest = null;
  try {
    sessionStorage.removeItem(BIRTH_KEY);
    sessionStorage.removeItem(CALCULATION_REQUEST_KEY);
  } catch {
    /* ignore */
  }
  announce(null);
}

/** Подсказка «права были» — только чтобы не мигать замками до ответа `/auth/me`.
 * Доступ она не открывает: разделы печатает сервер, проверив куку. */
export function cachePaid(paid: boolean): void {
  try {
    if (paid) localStorage.setItem(TARIFF_CACHE_KEY, "1");
    else localStorage.removeItem(TARIFF_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function cachedPaid(): boolean {
  try {
    return localStorage.getItem(TARIFF_CACHE_KEY) !== null;
  } catch {
    return false;
  }
}

export function forgetSession(): void {
  try {
    localStorage.removeItem(TARIFF_CACHE_KEY);
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Почта из формы оплаты при отказе сети: лид не теряется, отправится следующей попыткой. */
export function saveLead(v: StoredLead): void {
  try {
    localStorage.setItem(LEAD_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function loadLead(): StoredLead | null {
  try {
    const raw = localStorage.getItem(LEAD_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredLead;
    return typeof v?.email === "string" ? v : null;
  } catch {
    return null;
  }
}

export function clearLead(): void {
  try {
    localStorage.removeItem(LEAD_KEY);
  } catch {
    /* ignore */
  }
}
