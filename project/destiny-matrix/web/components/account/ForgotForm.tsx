"use client";

import { useHydrated } from "@/lib/hydrated";
import Link from "next/link";
import { useState } from "react";

import { ALL_FREE } from "@/lib/access";
import { ApiError, api } from "@/lib/api";
import { D, L } from "@/lib/i18n";
import { emailError, normalizeEmail } from "@/lib/email";
import { LEGAL } from "@/lib/site";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const wrong = emailError(email);
    if (wrong) return setError(wrong);
    setBusy(true);
    try {
      await api.resetRequest(normalizeEmail(email));
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : D.auth.generic[L]);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="panel narrow" data-testid="forgot-sent">
        <h1 className="panel-h1">{D.auth.mailSent[L]}</h1>
        <p className="dim">
          {D.auth.mailSentText[L](normalizeEmail(email))}
        </p>
        <p className="hint">
          {D.auth.noMail[L]}{" "}
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
        </p>
        {/* из этого экрана не было выхода: ошибиться в адресе можно, а переввести его — нет */}
        <button
          type="button"
          className="btn ghost wide"
          data-testid="forgot-again"
          onClick={() => setSent(false)}
        >
          {D.auth.otherAddress[L]}
        </button>
        <p className="hint">
          {D.auth.rememberedPassword[L]} <Link href="/login">{D.auth.signIn[L]}</Link>
        </p>
      </div>
    );
  }

  return (
    <form method="post" className="panel narrow" onSubmit={submit} data-testid="forgot-form"
          noValidate>
      <h1>{D.auth.forgotTitle[L]}</h1>
      <p className="dim">{D.auth.forgotLead[L]}</p>
      <label htmlFor="fmail">{D.auth.email[L]}</label>
      <input
        disabled={!hydrated}
        id="fmail"
        data-testid="forgot-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => {
          setError(null);
          setEmail(e.target.value);
        }}
        placeholder="you@mail.ru"
      />
      <button className="btn wide" data-testid="forgot-submit" style={{ marginTop: 14 }} disabled={busy || !hydrated}>
        {!hydrated ? D.auth.preparing[L] : busy ? D.auth.sending[L] : D.auth.sendLink[L]}
      </button>
      {error ? <div className="err" role="alert" aria-live="assertive">{error}</div> : null}
      <p className="hint">
        {D.auth.rememberedPassword[L]} <Link href="/login">{D.auth.signIn[L]}</Link>
      </p>
    </form>
  );
}
