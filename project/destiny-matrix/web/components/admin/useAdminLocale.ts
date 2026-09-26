"use client";

import { useState } from "react";
import { ApiError, forLocale as apiForLocale } from "@/lib/api";
import { forLocale } from "@/lib/adminLocale";
import { forLocale as matrixForLocale } from "@/lib/matrix";
import { forLocale as tariffForLocale } from "@/lib/tariffs";
import { forLocale as targetForLocale } from "@/lib/paytarget";
import { useLocale } from "@/components/ui/LocaleProvider";

export function useAdminLocale() {
  const L = useLocale();
  return { L, ...forLocale(L), api: apiForLocale(L).api,
    money: tariffForLocale(L).money, paymentTargetLabel: targetForLocale(L).paymentTargetLabel,
    ...matrixForLocale(L) };
}

/** Keep the error itself so a language change can re-render it without replaying an action. */
export function useAdminMessage() {
  const L = useLocale();
  const [message, setMessage] = useState<ApiError | string | null>(null);
  const text = message instanceof ApiError ? message.messageFor(L)
    : message === null ? null : forLocale(L).t(message);
  return [text, setMessage] as const;
}
