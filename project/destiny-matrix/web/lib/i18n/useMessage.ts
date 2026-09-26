"use client";

import { useCallback, useState } from "react";
import type { Lang } from "./hosts";

/** Store the meaning of a message; choose its text when rendering the current locale. */
export type Message = Record<Lang, string> | ((locale: Lang) => string | null);

export function useMessage(locale: Lang) {
  const [message, storeMessage] = useState<Message | null>(null);
  const setMessage = useCallback((next: Message | null) => storeMessage(() => next), []);
  const text = typeof message === "function" ? message(locale) : message?.[locale] ?? null;
  return [text, setMessage] as const;
}
