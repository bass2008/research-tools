"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/LocalizedLink";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ApiError, forLocale } from "@/lib/api";
import { publicPath } from "@/lib/publicRouting";
import { useSession } from "@/components/account/useSession";
import type { IndividualReading } from "@/lib/individualReading";

const ReadingContext = createContext<IndividualReading | null>(null);
export function useOptionalIndividualReading() {
  return useContext(ReadingContext);
}
export function useIndividualReading() {
  const reading = useContext(ReadingContext);
  if (!reading) throw new Error("IndividualReadingAccess is required");
  return reading;
}

// Check email-token access before displaying the article or redirecting to login.
export default function IndividualReadingAccess({ id, children }: { id: number; children: ReactNode }) {
  const L = useLocale(), en = L === "en";
  const router = useRouter();
  const session = useSession();
  const [row, setRow] = useState<IndividualReading | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  useEffect(() => {
    let live = true;
    setRow(null); setError(null);
    const key = `individual-reading:${id}`;
    const fragment = new URLSearchParams(window.location.hash.slice(1)).get("token");
    let token = fragment ?? "";
    try {
      if (fragment) sessionStorage.setItem(key, fragment);
      else token = sessionStorage.getItem(key) ?? "";
      if (fragment) history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch { /* The original fragment remains usable when session storage is unavailable. */ }
    forLocale(L).api.individualArticle(id, token).then(value => { if (live) setRow(value); })
      .catch(e => { if (live) setError({ status: e instanceof ApiError ? e.status : 0, message: e instanceof ApiError ? e.messageFor(L) : en ? "Unable to load the article." : "Не удалось загрузить статью." }); });
    return () => { live = false; };
  }, [id, L, en]);

  const denied = error?.status === 401 || error?.status === 403;
  const redirectToLogin = denied && session.status === "guest";
  useEffect(() => {
    if (redirectToLogin) router.replace(publicPath(`/login?reading=${id}`, L));
  }, [redirectToLogin, router, id, L]);
  if (row?.article) return <ReadingContext.Provider value={row}>{children}</ReadingContext.Provider>;
  return <main id="content" className="page"><div className="wrap">
    {error && !redirectToLogin && session.status !== "loading" ? <div className="panel narrow" data-testid="individual-access-message">
      <h3>{denied ? (en ? "This reading is private" : "Этот разбор доступен владельцу")
        : (en ? "Unable to open the reading" : "Не удалось открыть разбор")}</h3>
      <p className="dim">{denied
        ? (en ? "Use the account this individual reading was prepared for." : "Войдите в аккаунт, для которого подготовлен этот индивидуальный разбор.")
        : error.message}</p>
      {denied ? <Link className="btn wide" href={session.status === "user" ? "/account" : `/login?reading=${id}`}>
        {session.status === "user" ? (en ? "My account" : "В кабинет") : (en ? "Sign in" : "Войти")}
      </Link> : <button className="btn wide" onClick={() => window.location.reload()}>{en ? "Try again" : "Попробовать снова"}</button>}
    </div> : <p className="narrow skeleton" role="status">{en ? "Loading…" : "Загружаем…"}</p>}
  </div></main>;
}
