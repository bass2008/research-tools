// Дата рождения живёт только в браузере: sessionStorage, никогда не в URL и не в аналитике.
// Токена здесь нет намеренно: сессия — httpOnly-кука, которую ставит BFF, из JS она не читается.
import type { Sex } from "./matrix";

const BIRTH_KEY = "destiny.birth";
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

export function saveBirth(v: StoredBirth): void {
  try {
    sessionStorage.setItem(BIRTH_KEY, JSON.stringify(v));
  } catch {
    /* приватный режим — работаем без запоминания */
  }
}

export function loadBirth(): StoredBirth | null {
  try {
    const raw = sessionStorage.getItem(BIRTH_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredBirth;
    if (typeof v?.birth !== "string" || (v.sex !== "m" && v.sex !== "f")) return null;
    return v;
  } catch {
    return null;
  }
}

export function clearBirth(): void {
  try {
    sessionStorage.removeItem(BIRTH_KEY);
  } catch {
    /* ignore */
  }
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
