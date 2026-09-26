"use client";

import { forLocale as localizedUseSession } from "@/components/account/useSession";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ApiError, forLocale as localizedApi } from "@/lib/api";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { useMessage } from "@/lib/i18n/useMessage";
import type { PayStage as Stage } from "@/lib/payresult";
import { forLocale as localizedPayresult } from "@/lib/payresult";
import Link from "next/link";
import { useEffect, useState } from "react";

export const forLocale = localized((L: Locale) => {
  const { api } = localizedApi(L);
  const { resultTitle } = localizedPayresult(L);
  const { refreshSession } = localizedUseSession(L);

  const WAIT_STEPS = [0, 2000, 4000, 8000];
  return { api, resultTitle, refreshSession, WAIT_STEPS };
});

export default function PayResult({ locale: requestedLocale, ...localeProps }: ({ order: string; outcome: "done" | "fail" }) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { order, outcome } = localeProps;
  const { api, resultTitle, refreshSession, WAIT_STEPS } = forLocale(L);

  const [stage, setStage] = useState<Stage>("checking");
  const [note, setNote] = useMessage(L);
  const [matrixId, setMatrixId] = useState<number | null>(null);

  // Заголовок вкладки следует за состоянием: статический «Оплата прошла» обещал исход ещё до
  // ответа банка, а при отказе по карте говорил то же самое.
  useEffect(() => {
    document.title = `${resultTitle(stage)} — Arcana Sense`;
  }, [stage, resultTitle]);

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
            setNote((locale) => D.payResult.invoiceGone[locale]);
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
            setMatrixId(res.matrix_id);
            setStage("failed");
            return;
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            setStage("pending");
            setNote((locale) => D.payResult.ownerOnly[locale]);
            return;
          }
          setStage("error");
          setNote((locale) => err instanceof ApiError ? err.messageFor(locale) : D.payResult.noServer[locale]);
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
        <h1>{D.payResult.accessOpen[L]}</h1>
        <p className="dim">{D.payResult.paidSaved[L]}</p>
        <Link className="btn wide" href={matrixId ? `/report?m=${matrixId}` : "/report"}>
          {D.payResult.openFull[L]}
        </Link>
        <p className="hint">
          <Link href="/account">{D.nav.account[L]}</Link>
        </p>
      </div>
    );
  }

  if (stage === "refunded") {
    return (
      <div className="panel paybox">
        <h1>{D.payResult.refundedTitle[L]}</h1>
        <p className="dim">
          {D.payResult.refundedText[L]}
        </p>
        <Link className="btn wide" href={matrixId ? `/pay?m=${matrixId}` : "/pay"}>
          {D.payResult.payAgain[L]}
        </Link>
        <Link className="btn ghost wide" href="/account" style={{ marginTop: 8 }}>
          {D.nav.account[L]}
        </Link>
      </div>
    );
  }

  if (stage === "failed") {
    return (
      <div className="panel paybox">
        <h1>{D.payResult.failedTitle[L]}</h1>
        <p className="dim">{D.payResult.failedText[L]}</p>
        <Link className="btn wide" href={matrixId ? `/pay?m=${matrixId}` : "/pay"}>
          {D.payResult.backToPay[L]}
        </Link>
      </div>
    );
  }

  if (stage === "checking") {
    return (
      <div className="panel paybox">
        <h1>{D.payResult.checkingTitle[L]}</h1>
        <p className="dim">{D.payResult.checkingText[L]}</p>
      </div>
    );
  }

  return (
    <div className="panel paybox">
      <h1>{stage === "error" ? D.payResult.unknownTitle[L] : D.payResult.pendingTitle[L]}</h1>
      <p className="dim">
        {note ??
          D.payResult.pendingText[L]}
      </p>
      <Link className="btn wide" href="/account">
        {D.payResult.toAccount[L]}
      </Link>
    </div>
  );
}
