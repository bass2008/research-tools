"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import { ApiError, forLocale } from "@/lib/api";
import { useMessage } from "@/lib/i18n/useMessage";
import { confirmationResults, operationText } from "@/lib/i18n/dict/accountOperations";
import { publicPath } from "@/lib/publicRouting";
import { refreshSession } from "./useSession";

export default function ConfirmOperation() {
  const L = useLocale();
  const en = L === "en";
  const router = useRouter();
  const started = useRef(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useMessage(L);
  const [result, setResult] = useState<keyof typeof confirmationResults | null>(null);

  useEffect(() => {
    // A token works once: the second development-mode effect would report it as used.
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    const kind = params.get("kind");
    if (!token || (kind !== "change_email" && kind !== "verify_email")) {
      setMissing(true);
      return;
    }
    void (async () => {
      try {
        const response = await forLocale(L).api.confirmEmail(kind === "change_email" ? "change" : "verification", token);
        window.history.replaceState(null, "", window.location.pathname);
        const outcome = "verified" in response ? "verified" : response.changed ? "changed" : "waiting";
        const session = await refreshSession(L);
        if (outcome !== "changed" && session.status === "user") router.replace(publicPath("/account?tab=profile", L));
        else setResult(outcome);
      } catch (e) {
        setError(locale => e instanceof ApiError ? e.messageFor(locale) : operationText.confirmFailed[locale]);
      }
    })();
  }, []);

  return (
    <div className="panel narrow">
      <h1>{en ? "Email confirmation" : "Подтверждение почты"}</h1>
      {result ? (
        <>
          <p role="status">{confirmationResults[result][L]}</p>
          <Link className="btn" href="/login">{en ? "Sign in" : "Войти"}</Link>
        </>
      ) : missing ? (
        <p className="err">{operationText.missingLink[L]}</p>
      ) : !error && <p>{en ? "Confirming…" : "Подтверждаем…"}</p>}
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
