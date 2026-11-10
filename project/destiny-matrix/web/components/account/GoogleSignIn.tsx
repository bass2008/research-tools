"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import Link from "@/components/ui/LocalizedLink";
import { ApiError, forLocale, type AuthResponse, type GoogleAuthChallenge } from "@/lib/api";
import type { Lang } from "@/lib/i18n/lang";
import { googleIdentity, renderGoogleButton } from "@/lib/googleIdentity";

interface Props {
  locale: Lang;
  mode: "login" | "register";
  consent: boolean;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onAuthenticated: (result: AuthResponse) => Promise<void>;
}

export default function GoogleSignIn(props: Props) {
  const { locale, mode, consent, disabled } = props, en = locale === "en";
  const { api } = forLocale(locale);
  const [enabled, setEnabled] = useState(false);
  const [challenge, setChallenge] = useState<GoogleAuthChallenge | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [linking, setLinking] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  const pending = useRef<{ credential: string; challenge: string } | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const latest = useRef(props); latest.current = props;
  const passwordInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; pending.current = null;
      if (inFlight.current) latest.current.onBusy(false);
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const config = await api.googleConfig();
        if (stopped) return;
        if (!config.enabled || !config.client_id) { setEnabled(false); return; }
        setEnabled(true);
        const next = await api.googleChallenge();
        if (stopped) return;
        if (!next.challenge || !next.nonce || next.client_id !== config.client_id) throw new Error("Invalid challenge");
        setChallenge(next);
      } catch {
        // Password entry remains available if Google is unavailable or unconfigured.
        if (!stopped) setError(en ? "Google sign-in is unavailable. You can use email and password." : "Вход Google недоступен. Можно войти по почте и паролю.");
      }
    })();
    return () => { stopped = true; };
  }, [api, en, retry]);

  async function authenticate(credential: string, challengeValue: string, currentPassword?: string) {
    if (inFlight.current || !mounted.current || latest.current.disabled || !latest.current.consent) return;
    inFlight.current = true; setBusy(true); latest.current.onBusy(true); setError("");
    try {
      const result = await api.googleLogin(credential, challengeValue, currentPassword);
      if (!mounted.current) return;
      pending.current = null; setPassword(""); setLinking(false);
      await latest.current.onAuthenticated(result);
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof ApiError && cause.code === "google_link_required") {
        pending.current = { credential, challenge: challengeValue };
        setLinking(true);
      } else {
        setError(cause instanceof ApiError ? cause.messageFor(locale)
          : en ? "Google sign-in could not be completed. Please try again." : "Не удалось завершить вход Google. Попробуйте ещё раз.");
        // Keep a password-confirmation attempt for retry; all other credentials are discarded.
        if (!pending.current) setChallenge(null);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) { setBusy(false); latest.current.onBusy(false); }
    }
  }

  useEffect(() => { if (linking) passwordInput.current?.focus(); }, [linking]);

  useEffect(() => {
    if (!challenge || !scriptReady || !consent || !element.current) return;
    const identity = googleIdentity();
    if (!identity) { setScriptFailed(true); setError(en ? "Google sign-in could not load." : "Не удалось загрузить вход Google."); return; }
    let active = true;
    try {
      renderGoogleButton(identity, element.current, challenge, locale, mode, response => {
        // Closing the GIS popup produces no credential and never locks the password form.
        if (!active || !response?.credential) return;
        void authenticate(response.credential, challenge.challenge);
      });
    } catch { setScriptFailed(true); setError(en ? "Google sign-in could not load." : "Не удалось загрузить вход Google."); }
    return () => { active = false; element.current?.replaceChildren(); };
  }, [challenge, scriptReady, consent, locale, mode]);

  function startAgain() {
    if (scriptFailed) { window.location.reload(); return; }
    pending.current = null; setPassword(""); setLinking(false); setError(""); setChallenge(null); setRetry(n => n + 1);
  }
  function confirmLink() {
    const attempt = pending.current;
    if (attempt && password) void authenticate(attempt.credential, attempt.challenge, password);
  }
  if (!enabled) return error ? <p className="hint" role="status">{error}</p> : null;
  return <section aria-label={en ? "Google sign-in" : "Вход Google"} style={{ margin: "18px 0" }}>
    <Script id="google-identity-services" src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
      onReady={() => setScriptReady(true)} onError={() => { setScriptFailed(true); setError(en ? "Google sign-in could not load. You can use email and password." : "Не удалось загрузить вход Google. Можно войти по почте и паролю."); }} />
    {!consent && <p className="hint">{en ? "Confirm your agreement above to continue with Google." : "Чтобы продолжить с Google, подтвердите согласие выше."}</p>}
    <div ref={element} data-testid="google-sign-in" aria-hidden={!consent || linking || busy || disabled}
      style={{ display: !consent || linking || busy || disabled ? "none" : "block" }} />
    {mode === "login" && <p className="hint">{en ? "By continuing with Google, you accept the " : "Продолжая с Google, вы принимаете "}
      <Link href="/terms" target="_blank" rel="noopener">{en ? "Terms" : "условия использования"}</Link>{en ? " and " : " и "}
      <Link href="/privacy" target="_blank" rel="noopener">{en ? "Privacy Policy" : "политику конфиденциальности"}</Link>.</p>}
    {busy && <p role="status">{en ? "Signing in…" : "Выполняется вход…"}</p>}
    {linking && <form onSubmit={event => { event.preventDefault(); confirmLink(); }}>
      <p>{en ? "This email already has an Arcana Sense account. Enter its current password to connect Google and keep your readings and purchases." : "Для этой почты уже есть аккаунт Arcana Sense. Введите его текущий пароль, чтобы подключить Google и сохранить разборы и покупки."}</p>
      <label htmlFor="google-link-password">{en ? "Current Arcana Sense password" : "Текущий пароль Arcana Sense"}</label>
      <input ref={passwordInput} id="google-link-password" type="password" autoComplete="current-password" maxLength={200}
        value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required />
      <button type="submit" className="btn" disabled={busy || !password}>{en ? "Connect and sign in" : "Подключить и войти"}</button>{" "}
      <button type="button" className="btn ghost" disabled={busy} onClick={startAgain}>{en ? "Cancel" : "Отмена"}</button>
      <p className="hint"><Link href="/forgot">{en ? "Reset the account password" : "Восстановить пароль аккаунта"}</Link></p>
    </form>}
    {error && <p className="err" role="alert">{error}</p>}
    {error && !busy && <button type="button" className="btn ghost sm" onClick={startAgain}>{scriptFailed
      ? (en ? "Reload page" : "Обновить страницу") : (en ? "Try Google again" : "Повторить вход Google")}</button>}
    {!linking && <p className="hint">{en ? "Or use your email and password below." : "Или используйте почту и пароль ниже."}</p>}
  </section>;
}
