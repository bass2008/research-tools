"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api";
import { resultTitle } from "@/lib/payresult";

import { refreshSession } from "./useSession";

import type { PayStage as Stage } from "@/lib/payresult";



const WAIT_STEPS = [0, 2000, 4000, 8000];

export default function PayResult({ order, outcome }: { order: string; outcome: "done" | "fail" }) {
  const [stage, setStage] = useState<Stage>("checking");
  const [note, setNote] = useState<string | null>(null);
  const [matrixId, setMatrixId] = useState<number | null>(null);

  // Заголовок вкладки следует за состоянием: статический «Оплата прошла» обещал исход ещё до
  // ответа банка, а при отказе по карте говорил то же самое.
  useEffect(() => {
    document.title = `${resultTitle(stage)} — Arcana Sense`;
  }, [stage]);

  // Уведомление банка и возврат покупателя идут независимо, поэтому статус переспрашиваем
  // несколько раз: к моменту редиректа платёж мог быть ещё AUTHORIZED.
  useEffect(() => {
    if (!order) {
      setStage("failed");
      return;
    }
    let stop = false;
    (async () => {
      for (const pause of WAIT_STEPS) {
        if (stop) return;
        if (pause) await new Promise((r) => setTimeout(r, pause));
        try {
          const res = await api.paySync(order);
          // Возврат проверяем раньше оплаты: у возвращённого платежа отметка об оплате остаётся,
          // и страница поздравляла с покупкой при каждой перезагрузке, хотя деньги уже вернулись.
          if (res.state === "abandoned") {
            setStage("failed");
            setNote("Счёт больше не действует — оплату можно начать заново.");
            return;
          }
          if (res.state === "refunded") {
            // Цель обязательна: без неё «Оплатить снова» уводило на общую оплату, а та берёт
            // верхнюю дату кабинета — деньги уходили за другую дату, возвращённая оставалась
            // закрытой. Проверено живыми деньгами на тестовом терминале.
            setMatrixId(res.matrix_id);
            setStage("refunded");
            return;
          }
          if (res.paid) {
            setMatrixId(res.matrix_id);
            await refreshSession();
            setStage("paid");
            return;
          }
          if (res.state === "failed") {
            setStage("failed");
            return;
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            setStage("pending");
            setNote("Войдите в аккаунт, на который оформляли платёж, — состояние платежа видно только владельцу.");
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

  if (stage === "refunded") {
    return (
      <div className="panel paybox">
        <h3>Платёж возвращён</h3>
        <p className="dim">
          Деньги вернулись тем же способом, которым платили. Разбор закрыт, сохранённая дата осталась
          в кабинете — при желании можно оплатить снова.
        </p>
        <Link className="btn wide" href={matrixId ? `/pay?m=${matrixId}` : "/pay"}>
          Оплатить снова
        </Link>
        <Link className="btn ghost wide" href="/account" style={{ marginTop: 8 }}>
          Кабинет
        </Link>
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
