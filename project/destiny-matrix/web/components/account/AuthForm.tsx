"use client";

import { useHydrated } from "@/lib/hydrated";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ApiError, api } from "@/lib/api";

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
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Проверьте адрес почты.");
      emailInput.current?.focus();
      return;
    }
    if (password.length < 3) {
      setError("Пароль — не короче трёх знаков.");
      passwordInput.current?.focus();
      return;
    }
    if (isRegister && !agreed) {
      setError("Нужно согласие на обработку персональных данных.");
      consentInput.current?.focus();
      return;
    }
    setBusy(true);
    try {
      // Токен ставит BFF в httpOnly-куку; в ответе его нет, и в localStorage он не попадает.
      if (isRegister) await api.register(email, password);
      else await api.login(email, password);
      await refreshSession();
      // После регистрации пустая форма больше не должна оставаться в истории: «Назад» на неё
      // приводил уже вошедшего человека, которому повторная отправка отвечала «почта занята».
      router.replace("/account");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось. Попробуйте ещё раз.");
      // Ошибка остаётся объявленной через role=alert, но набор продолжается в поле, которое
      // человек может исправить, а не в нефокусируемом тексте сообщения.
      (isRegister ? emailInput.current : passwordInput.current)?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form method="post" className="form narrow" onSubmit={submit}>
      <h1>{isRegister ? "Регистрация" : "Вход"}</h1>
      <div className="sub">
        {isRegister
          ? "Аккаунт нужен, чтобы хранить сохранённые матрицы и доступ к разделам."
          : "Введите почту и пароль, которые указывали при покупке."}
      </div>

      <label htmlFor="email">Почта</label>
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
        Пароль
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
        placeholder="не короче 3 знаков"
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
            Согласен(на) на обработку персональных данных на условиях{" "}
            <Link href="/privacy" target="_blank" rel="noopener">политики обработки персональных данных</Link> и принимаю{" "}
            <Link href="/oferta" target="_blank" rel="noopener">публичную оферту</Link>.
          </span>
        </label>
      ) : null}

      <button className="btn wide" data-testid="auth-submit" style={{ marginTop: 14 }} disabled={busy || !hydrated}>
        {!hydrated ? "Готовим форму…" : busy ? "Отправляем…" : isRegister ? "Создать аккаунт" : "Войти"}
      </button>

      {error ? (
        <div className="err" role="alert" aria-live="assertive">
          {error}
        </div>
      ) : null}

      <p className="hint">
        {isRegister ? (
          <>
            Уже есть аккаунт? <Link href="/login">Войти</Link>
          </>
        ) : (
          <>
            Нет аккаунта? <Link href="/register">Зарегистрироваться</Link> · забыли пароль?{" "}
            <Link href="/forgot">Восстановить</Link>
          </>
        )}
      </p>
    </form>
  );
}
