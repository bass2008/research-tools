"use client";

import { forLocale as localizedUseSession } from "@/components/account/useSession";
import { useLocale } from "@/components/ui/LocaleProvider";
import { trackPurchase } from "@/lib/analytics";
import { ApiError, forLocale as localizedApi } from "@/lib/api";
import { D, forLocale as localizedI18n } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { useMessage } from "@/lib/i18n/useMessage";
import type { PayStage as Stage } from "@/lib/payresult";
import { forLocale as localizedPayresult } from "@/lib/payresult";
import { payHref, readingHref, type ReadingRef } from "@/lib/readingLinks";
import Link from "@/components/ui/LocalizedLink";
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
  const [reading, setReading] = useState<ReadingRef | null>(null);
  // что сервер сказал о покупке: подписка без разбора и исход возврата
  const [facts, setFacts] = useState<{ subscription: boolean; until: string | null; outcome?: string }>(
    { subscription: false, until: null });

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
          if (stop) return;
          setFacts({ subscription: res.subscription === true, until: res.until ?? null, outcome: res.outcome });
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
            setReading(res.matrix_id ? { id: res.matrix_id, product: res.product } : null);
            setStage("refunded");
            return;
          }
          if (res.paid) {
            trackPurchase(res.payment_id, { tariff: res.tariff });
            setReading(res.matrix_id ? { id: res.matrix_id, product: res.product } : null);
            await refreshSession();
            setStage("paid");
            return;
          }
          if (res.state === "failed") {
            setReading(res.matrix_id ? { id: res.matrix_id, product: res.product } : null);
            setStage("failed");
            return;
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            setStage("sign-in");
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

  if (stage === "paid" && facts.subscription && !reading) {
    return (
      <div className="panel paybox">
        <h1>{D.payResult.accessOpen[L]}</h1>
        <p className="dim">
          {D.payResult.subscriptionPaid[L](facts.until ? localizedI18n(L).dateLabel(facts.until.slice(0, 10), L) : "")}
        </p>
        <Link className="btn wide" href="/#calc">
          {D.payResult.calculate[L]}
        </Link>
        <p className="hint">
          <Link href="/compatibility">{D.payResult.calculatePair[L]}</Link>{" · "}
          <Link href="/account">{D.nav.account[L]}</Link>
        </p>
      </div>
    );
  }

  if (stage === "paid") {
    return (
      <div className="panel paybox">
        <h1>{D.payResult.accessOpen[L]}</h1>
        <p className="dim">{D.payResult.paidSaved[L]}</p>
        <Link className="btn wide" href={readingHref(reading)}>
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
        {/* что стало с доступом, говорит сервер: разбор мог остаться открытым выдачей или
            подпиской, и «разбор закрыт, оплатите снова» было неправдой */}
        <p className="dim">
          {facts.outcome ? `${D.payResult.moneyBack[L]} ${facts.outcome}` : D.payResult.refundedText[L]}
        </p>
        {/* Деньги вернули по просьбе покупателя: предлагать заплатить снова на этом же экране незачем. */}
        <Link className="btn wide" href="/account">
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
        {/* у подписки нет разбора: голый /pay выбирал разовый тариф, и вместо подписки
            предлагалась дата за 250 ₽ */}
        <Link className="btn wide" href={facts.subscription && !reading ? "/pay/month" : payHref(reading)}>
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
      <h1>{stage === "sign-in" ? D.payResult.signInTitle[L]
        : stage === "error" ? D.payResult.unknownTitle[L] : D.payResult.pendingTitle[L]}</h1>
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
