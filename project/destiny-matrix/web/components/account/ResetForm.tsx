"use client";

import { useHydrated } from "@/lib/hydrated";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ApiError, api } from "@/lib/api";
import { D, L } from "@/lib/i18n";

import { refreshSession } from "@/components/account/useSession";

export default function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 3) return setError(D.auth.shortPassword[L]);
    setBusy(true);
    try {
      await api.resetApply(token, password);
      await refreshSession();
      router.push("/account");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : D.auth.generic[L]);
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
