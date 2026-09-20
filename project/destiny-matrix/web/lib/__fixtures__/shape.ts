// Эталон разделён на числа и подписи: движок на Python знает подписи только по-русски, а фронт
// собирается под язык развёртки. `numeric` снимает то, что обязано совпадать всегда; `texts`
// собирает подписи в том же порядке, что и Python (ключи сортируются), чтобы их можно было
// сверить с языковым эталоном там, где язык совпадает.
export const TEXT_KEYS = ["hint", "label", "lead", "teaser", "title"] as const;

const isText = (key: string): boolean => (TEXT_KEYS as readonly string[]).includes(key);

export function numeric<T>(value: T): T {
  if (Array.isArray(value)) return value.map(numeric) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (!isText(key)) out[key] = numeric(v);
    }
    return out as unknown as T;
  }
  return value;
}

export function texts(value: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(value)) {
    for (const v of value) out.push(...texts(v));
  } else if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    for (const key of Object.keys(row).sort()) {
      if (isText(key)) out.push(String(row[key]));
      else out.push(...texts(row[key]));
    }
  }
  return out;
}
