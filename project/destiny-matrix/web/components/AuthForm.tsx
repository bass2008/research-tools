"use client";

import { useHydrated } from "@/lib/hydrated";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, api } from "@/lib/api";

import { refreshSession } from "./useSession";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();

  const isRegister = mode === "register";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Проверьте адрес почты.");
    if (password.length < 3) return setError("Пароль — не короче трёх знаков.");
    if (isRegister && !agreed) return setError("Нужно согласие на обработку персональных данных.");
    setBusy(true);
    try {
      // Токен ставит BFF в httpOnly-куку; в ответе его нет, и в localStorage он не попадает.
      if (isRegister) await api.register(email, password);
      else await api.login(email, password);
      await refreshSession();
      router.push("/account");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form method="post" className="form narrow" onSubmit={submit}>
      <h2>{isRegister ? "Регистрация" : "Вход"}</h2>
      <div className="sub">
        {isRegister
          ? "Аккаунт нужен, чтобы хранить сохранённые матрицы и доступ к разделам."
          : "Введите почту и пароль, которые указывали при покупке."}
      </div>

      <label htmlFor="email">Почта</label>
      <input
        disabled={!hydrated}
        id="email"
        data-testid="auth-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@mail.ru"
      />

      <label htmlFor="password" style={{ marginTop: 12 }}>
        Пароль
      </label>
      <input
        disabled={!hydrated}
        id="password"
        data-testid="auth-password"
        name="password"
        type="password"
        autoComplete={isRegister ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="не короче 3 знаков"
      />

      {isRegister ? (
        <label className="consent">
          <input
            type="checkbox"
            disabled={!hydrated}
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            Согласен(на) на обработку персональных данных на условиях{" "}
            <Link href="/privacy" target="_blank" rel="noopener">политики обработки персональных данных</Link> и принимаю{" "}
            <Link href="/oferta" target="_blank" rel="noopener">публичную оферту</Link>.
          </span>
        </label>
      ) : null}

      <button className="btn wide" data-testid="auth-submit" style={{ marginTop: 14 }} disabled={busy || !hydrated}>
        {busy ? "Отправляем…" : isRegister ? "Создать аккаунт" : "Войти"}
      </button>

      {error ? <div className="err">{error}</div> : null}

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
