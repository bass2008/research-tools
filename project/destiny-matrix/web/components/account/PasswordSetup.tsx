"use client";

import { useState } from "react";
import { ApiError, forLocale } from "@/lib/api";
import type { Lang } from "@/lib/i18n/lang";

/** Google-only accounts establish a password through the existing email reset flow. */
export default function PasswordSetup({ email, locale }: { email: string; locale: Lang }) {
  const en = locale === "en", { api } = forLocale(locale);
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState("");
  async function send() {
    if (busy) return;
    setBusy(true); setError("");
    try { await api.resetRequest(email); setSent(true); }
    catch (cause) { setError(cause instanceof ApiError ? cause.messageFor(locale) : en ? "Please try again." : "Попробуйте ещё раз."); }
    finally { setBusy(false); }
  }
  return <div data-testid="password-setup">
    <p>{en ? "This account uses Google and has no password yet. Set a password by email before changing your email address or requesting account deletion. Google sign-in will remain available."
      : "В этом аккаунте используется вход Google, пароль ещё не установлен. Создайте пароль по ссылке из письма, чтобы изменить почту или запросить удаление аккаунта. Вход Google сохранится."}</p>
    {sent ? <p role="status">{en ? `Check ${email} for a link to set your password, then return to your account.`
      : `Проверьте ${email}: в письме будет ссылка для установки пароля. После этого вернитесь в аккаунт.`}</p>
      : <button className="btn ghost" type="button" onClick={() => void send()} disabled={busy}>
        {busy ? "…" : en ? "Email a password setup link" : "Получить ссылку для установки пароля"}</button>}
    {error && <p className="err" role="alert">{error}</p>}
  </div>;
}
