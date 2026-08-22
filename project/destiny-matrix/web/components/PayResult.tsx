"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api";

import { refreshSession } from "./useSession";

type Stage = "checking" | "paid" | "pending" | "failed" | "error";

const WAIT_STEPS = [0, 2000, 4000, 8000];

export default function PayResult({ order, outcome }: { order: string; outcome: "done" | "fail" }) {
  const [stage, setStage] = useState<Stage>(outcome === "fail" ? "failed" : "checking");
  const [note, setNote] = useState<string | null>(null);
  const [matrixId, setMatrixId] = useState<number | null>(null);

  // Уведомление банка и возврат покупателя идут независимо, поэтому статус переспрашиваем
  // несколько раз: к моменту редиректа платёж мог быть ещё AUTHORIZED.
  useEffect(() => {
    if (outcome === "fail" || !order) return;
    let stop = false;
    (async () => {
      for (const pause of WAIT_STEPS) {
        if (stop) return;
        if (pause) await new Promise((r) => setTimeout(r, pause));
        try {
          const res = await api.paySync(order);
          if (res.paid) {
            setMatrixId(res.matrix_id);
            await refreshSession();
            setStage("paid");
            return;
          }
          if (["REJECTED", "CANCELED", "DEADLINE_EXPIRED", "REVERSED"].includes(res.status)) {
            setStage("failed");
            return;
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            setStage("pending");
            setNote("Войдите в аккаунт, на который оформляли платёж, — доступ уже привязан к нему.");
            return;
          }
          setStage("error");
          setNote(err instanceof ApiError ? err.message : "Сервер не ответил.");
          return;
        }
      }
      setStage("pending");
    })();
    return () => {
      stop = true;
    };
  }, [order, outcome]);

  if (stage === "paid") {
    return (
      <div className="panel paybox">
        <h3>Доступ открыт</h3>
        <p className="dim">Платёж прошёл, разбор сохранён в кабинете.</p>
        <Link className="btn wide" href={matrixId ? `/report?m=${matrixId}` : "/report"}>
          Открыть полный разбор
        </Link>
        <p className="hint">
          <Link href="/account">Кабинет</Link>
        </p>
      </div>
    );
  }

  if (stage === "failed") {
    return (
      <div className="panel paybox">
        <h3>Платёж не прошёл</h3>
        <p className="dim">Деньги не списаны. Можно попробовать ещё раз — другой картой или позже.</p>
        <Link className="btn wide" href="/pay">
          Вернуться к оплате
        </Link>
      </div>
    );
  }

  if (stage === "checking") {
    return (
      <div className="panel paybox">
        <h3>Проверяем платёж</h3>
        <p className="dim">Спрашиваем банк о результате — это занимает пару секунд.</p>
      </div>
    );
  }

  return (
    <div className="panel paybox">
      <h3>{stage === "error" ? "Не удалось проверить платёж" : "Платёж ещё обрабатывается"}</h3>
      <p className="dim">
        {note ??
          "Банк пока не подтвердил оплату. Как только подтвердит, доступ откроется сам — " +
            "обновите кабинет через минуту."}
      </p>
      <Link className="btn wide" href="/account">
        В кабинет
      </Link>
    </div>
  );
}
