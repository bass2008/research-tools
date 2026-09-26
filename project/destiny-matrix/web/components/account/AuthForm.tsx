"use client";

import { forLocale as localizedUseSession } from "@/components/account/useSession";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ApiError, forLocale as localizedApi } from "@/lib/api";
import { forLocale as localizedEmail } from "@/lib/email";
import { useHydrated } from "@/lib/hydrated";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { useMessage } from "@/lib/i18n/useMessage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export const forLocale = localized((L: Locale) => {
  const { api } = localizedApi(L);
  const { emailError, normalizeEmail } = localizedEmail(L);
  const { refreshSession } = localizedUseSession(L);

  return { api, emailError, normalizeEmail, refreshSession };
});

export default function AuthForm({ locale: requestedLocale, ...localeProps }: ({ mode: "login" | "register" }) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { mode } = localeProps;
  const { api, emailError, normalizeEmail, refreshSession } = forLocale(L);

  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useMessage(L);
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
      setError((locale) => localizedEmail(locale).emailError(email));
      emailInput.current?.focus();
      return;
    }
    if (password.length < 3) {
      setError((locale) => D.auth.shortPassword[locale]);
      passwordInput.current?.focus();
      return;
    }
    if (isRegister && !agreed) {
      setError((locale) => D.auth.consentRequired[locale]);
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
      setError((locale) => err instanceof ApiError ? err.messageFor(locale) : D.auth.generic[locale]);
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
