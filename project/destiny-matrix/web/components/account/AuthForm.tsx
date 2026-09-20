"use client";

import { useHydrated } from "@/lib/hydrated";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ALL_FREE } from "@/lib/access";
import { ApiError, api } from "@/lib/api";
import { D, L } from "@/lib/i18n";
import { emailError, normalizeEmail } from "@/lib/email";

import { refreshSession } from "@/components/account/useSession";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailInput = useRef<HTMLInputElement | null>(null);
  const passwordInput = useRef<HTMLInputElement | null>(null);
  const consentInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();

  const isRegister = mode === "register";
  // Сообщение о проверке поля гасим на первом же изменении: иначе форма продолжает требовать
  // то, что человек уже сделал, — «нужно согласие» висит с поставленной галочкой.
  const clear = () => setError(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const mail = normalizeEmail(email);
    const wrong = emailError(email);
    if (wrong) {
      setError(wrong);
      emailInput.current?.focus();
      return;
    }
    if (password.length < 3) {
      setError(D.auth.shortPassword[L]);
      passwordInput.current?.focus();
      return;
    }
    if (isRegister && !agreed) {
      setError(D.auth.consentRequired[L]);
      consentInput.current?.focus();
      return;
    }
    setBusy(true);
    try {
      // Токен ставит BFF в httpOnly-куку; в ответе его нет, и в localStorage он не попадает.
      if (isRegister) await api.register(mail, password);
      else await api.login(mail, password);
      await refreshSession();
      // После регистрации пустая форма больше не должна оставаться в истории: «Назад» на неё
      // приводил уже вошедшего человека, которому повторная отправка отвечала «почта занята».
      router.replace("/account");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : D.auth.generic[L]);
      // Ошибка остаётся объявленной через role=alert, но набор продолжается в поле, которое
      // человек может исправить, а не в нефокусируемом тексте сообщения.
      (isRegister ? emailInput.current : passwordInput.current)?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form method="post" className="form narrow" onSubmit={submit} noValidate>
      <h1>{isRegister ? D.auth.registerTitle[L] : D.auth.loginTitle[L]}</h1>
      <div className="sub">
        {isRegister ? D.auth.registerLead[L] : D.auth.loginLead[L]}
      </div>

      <label htmlFor="email">{D.auth.email[L]}</label>
      <input
        ref={emailInput}
        disabled={!hydrated}
        id="email"
        data-testid="auth-email"
        maxLength={200}
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => {
          clear();
          setEmail(e.target.value);
        }}
        placeholder="you@mail.ru"
      />

      <label htmlFor="password" style={{ marginTop: 12 }}>
        {D.auth.password[L]}
      </label>
      <input
        ref={passwordInput}
        disabled={!hydrated}
        id="password"
        data-testid="auth-password"
        maxLength={200}
        name="password"
        type="password"
        autoComplete={isRegister ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => {
          clear();
          setPassword(e.target.value);
        }}
        placeholder={D.auth.passwordPlaceholder[L]}
      />

      {isRegister ? (
        <label className="consent">
          <input
            ref={consentInput}
            type="checkbox"
            disabled={!hydrated}
            checked={agreed}
            onChange={(e) => {
              clear();
              setAgreed(e.target.checked);
            }}
          />
          <span>
            {D.auth.consentHead[L]}{" "}
            <Link href="/privacy" target="_blank" rel="noopener">{D.auth.consentPolicy[L]}</Link>{" "}
            {D.auth.consentAnd[L]}{" "}
            <Link href="/terms" target="_blank" rel="noopener">{D.auth.consentTerms[L]}</Link>.
          </span>
        </label>
      ) : null}

      <button className="btn wide" data-testid="auth-submit" style={{ marginTop: 14 }} disabled={busy || !hydrated}>
        {!hydrated
          ? D.auth.preparing[L]
          : busy
            ? D.auth.sending[L]
            : isRegister
              ? D.auth.createAccount[L]
              : D.auth.signIn[L]}
      </button>

      {error ? (
        <div className="err" role="alert" aria-live="assertive">
          {error}
        </div>
      ) : null}

      <p className="hint">
        {isRegister ? (
          <>
            {D.auth.haveAccount[L]} <Link href="/login">{D.auth.signIn[L]}</Link>
          </>
        ) : (
          <>
            {D.auth.noAccount[L]} <Link href="/register">{D.auth.register[L]}</Link>{" "}
            {D.auth.forgotQuestion[L]} <Link href="/forgot">{D.auth.restore[L]}</Link>
          </>
        )}
      </p>
    </form>
  );
}
