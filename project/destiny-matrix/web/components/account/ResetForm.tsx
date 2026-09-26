"use client";

import { forLocale as localizedUseSession } from "@/components/account/useSession";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ApiError, forLocale as localizedApi } from "@/lib/api";
import { useHydrated } from "@/lib/hydrated";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { useMessage } from "@/lib/i18n/useMessage";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export const forLocale = localized((L: Locale) => {
  const { api } = localizedApi(L);
  const { refreshSession } = localizedUseSession(L);

  return { api, refreshSession };
});

export default function ResetForm({ locale: requestedLocale, ...localeProps }: ({}) & { locale?: Locale } = {}) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { api, refreshSession } = forLocale(L);

  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useMessage(L);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 3) return setError((locale) => D.auth.shortPassword[locale]);
    setBusy(true);
    try {
      await api.resetApply(token, password);
      await refreshSession();
      router.push("/account");
    } catch (err) {
      setError((locale) => err instanceof ApiError ? err.messageFor(locale) : D.auth.generic[locale]);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="panel narrow">
        <h1>{D.auth.incompleteLink[L]}</h1>
        <p className="dim">{D.auth.incompleteLinkText[L]}</p>
        <Link className="btn wide" href="/forgot">
          {D.auth.requestNewLink[L]}
        </Link>
      </div>
    );
  }

  return (
    <form method="post" className="panel narrow" onSubmit={submit} data-testid="reset-form">
      <h1>{D.auth.newPassword[L]}</h1>
      <p className="dim">{D.auth.newPasswordLead[L]}</p>
      <label htmlFor="rpass">{D.auth.password[L]}</label>
      <input
        disabled={!hydrated}
        id="rpass"
        data-testid="reset-password"
        maxLength={200}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => {
          setError(null);
          setPassword(e.target.value);
        }}
        placeholder={D.auth.passwordPlaceholder[L]}
      />
      <button className="btn wide" data-testid="reset-submit" style={{ marginTop: 14 }} disabled={busy || !hydrated}>
        {!hydrated ? D.auth.preparing[L] : busy ? D.auth.changing[L] : D.auth.changePassword[L]}
      </button>
      {error ? <div className="err" role="alert" aria-live="assertive">{error}</div> : null}
      <p className="hint">
        {D.auth.linkFailed[L]} <Link href="/forgot">{D.auth.requestNew[L]}</Link>
      </p>
    </form>
  );
}
