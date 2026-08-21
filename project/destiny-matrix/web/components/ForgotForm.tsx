"use client";

import Link from "next/link";
import { useState } from "react";

import { ApiError, api } from "@/lib/api";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Проверьте адрес почты.");
    setBusy(true);
    try {
      await api.resetRequest(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="panel narrow" data-testid="forgot-sent">
        <h3>Письмо отправлено</h3>
        <p className="dim">
          Если на {email.trim().toLowerCase()} есть аккаунт, ссылка для смены пароля уже там.
          Ссылка действует 4 часа.
        </p>
        <p className="hint">
          Письма нет? Проверьте папку со спамом или напишите на{" "}
          <a href="mailto:hello@arcana-sense.ru">hello@arcana-sense.ru</a>.
        </p>
      </div>
    );
  }

  return (
    <form className="panel narrow" onSubmit={submit} data-testid="forgot-form">
      <h3>Восстановление пароля</h3>
      <p className="dim">Пришлём ссылку для смены пароля на почту, указанную при оплате.</p>
      <label htmlFor="fmail">Почта</label>
      <input
        id="fmail"
        data-testid="forgot-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@mail.ru"
      />
      <button className="btn wide" data-testid="forgot-submit" style={{ marginTop: 14 }} disabled={busy}>
        {busy ? "Отправляем…" : "Прислать ссылку"}
      </button>
      {error ? <div className="err">{error}</div> : null}
      <p className="hint">
        Вспомнили пароль? <Link href="/login">Войти</Link>
      </p>
    </form>
  );
}
