export interface DailySelection { dateKey: string; arcanum: number }

/** An editorial calendar, shared by everyone on the same local date. No birth data. */
export function selectionForDate(now: Date): DailySelection {
  const year = now.getFullYear(), month = now.getMonth(), day = now.getDate();
  const ordinal = Math.floor(Date.UTC(year, month, day) / 86_400_000);
  return { dateKey: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    arcanum: ((ordinal * 7 + 12) % 22 + 22) % 22 + 1 };
}

export function millisecondsUntilTomorrow(now: Date): number {
  // Calendar construction respects a 23/25-hour day at daylight-saving transitions.
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, next.getTime() - now.getTime() + 25);
}

export function dailyDateLabel(dateKey: string, locale: 'ru' | 'en'): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long' });
}
