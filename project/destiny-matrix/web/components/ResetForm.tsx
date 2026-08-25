"use client";

import { useHydrated } from "@/lib/hydrated";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ApiError, api } from "@/lib/api";

import { refreshSession } from "./useSession";

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
    if (password.length < 3) return setError("Пароль — не короче трёх знаков.");
    setBusy(true);
    try {
      await api.resetApply(token, password);
      await refreshSession();
      router.push("/account");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="panel narrow">
        <h3>Ссылка неполная</h3>
        <p className="dim">В адресе нет кода восстановления — откройте ссылку из письма целиком.</p>
        <Link className="btn wide" href="/forgot">
          Запросить новую ссылку
        </Link>
      </div>
    );
  }

  return (
    <form method="post" className="panel narrow" onSubmit={submit} data-testid="reset-form">
      <h3>Новый пароль</h3>
      <p className="dim">После смены вы сразу войдёте в кабинет.</p>
      <label htmlFor="rpass">Пароль</label>
      <input
        disabled={!hydrated}
        id="rpass"
        data-testid="reset-password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="не короче 3 знаков"
      />
      <button className="btn wide" data-testid="reset-submit" style={{ marginTop: 14 }} disabled={busy || !hydrated}>
        {busy ? "Меняем…" : "Сменить пароль"}
      </button>
      {error ? <div className="err">{error}</div> : null}
      <p className="hint">
        Ссылка не сработала? <Link href="/forgot">Запросить новую</Link>
      </p>
    </form>
  );
}
