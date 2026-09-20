"use client";

import { useHydrated } from "@/lib/hydrated";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, api, type MatrixListItem } from "@/lib/api";
import { track } from "@/lib/analytics";
import { D, L } from "@/lib/i18n";
import { emailError, normalizeEmail } from "@/lib/email";
import { needsOwnerPassword, reduce, START, type PayEvent, type Stage } from "@/lib/payStage";
import { useBirth } from "@/lib/useBirth";
import { byId, capLabel, money, periodLabel, priceLabel, type Tariff } from "@/lib/tariffs";

import { birthLabel } from "@/components/matrix/MatrixResult";
import PayReceipt from "./PayReceipt";
import PayUnchecked from "./PayUnchecked";
import { usePayTarget, targetValue } from "./usePayTarget";
import { refreshSession, useSession } from "@/components/account/useSession";


const MIN_PASSWORD = 3;

/** Что даёт тариф — выводим из scope, а не из списка в разметке: тариф правят в базе. */
function optionNote(t: Tariff): string {
  const parts = [t.scope.includes("all") ? D.payForm.anyDates[L] : D.payForm.oneDate[L]];
  if (t.scope.includes("matrix")) parts.push(D.payForm.storedInAccount[L]);
  // «навсегда» на витрине спорило с офертой («не менее 12 месяцев»): обещаем то, что
  // выполняем — доступ без подписки и файл, который остаётся у человека
  parts.push(t.period_days === null
    ? D.payForm.noSubscription[L]
    : D.payForm.openedUntil[L](periodLabel(t)));
  return parts.join(" · ");
}

export default function PayForm({ tariffs, initial, test = false }: { tariffs: Tariff[]; initial: string
  /** деньги ненастоящие: предупреждение показываем только тогда */
  test?: boolean;
}) {
  const [chosen, setChosen] = useState(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();
  // экран оплаты — конечный автомат: переходы собраны в lib/payStage, а не разбросаны
  const [stage, setStage] = useState<Stage>(START);
  const send = (event: PayEvent) => setStage((now) => reduce(now, event));
  // дата рождения приходит одним источником: см. lib/useBirth
  const birth = useBirth();
  const [saved, setSaved] = useState<MatrixListItem[] | null>(null);
  // вошли в уже существующий аккаунт: об этом надо сказать, а не проводить молча
  const [signedInto, setSignedInto] = useState<string | null>(null);
  const params = useSearchParams();
  const wanted = Number(params.get("m") ?? "") || null;
  // Чек живёт по своему адресу: пока он был только состоянием формы, «Купить» из шапки
  // возвращал прошлую покупку вместо новой формы.
  const receipt = params.get("paid");
  const router = useRouter();
  // адрес оплаты бывает разным (/pay и /pay/<тариф>): чек обязан остаться на том же маршруте,
  // иначе переход уводит со страницы, состояние теряется и человек видит форму вместо «Доступ открыт»
  const here = usePathname();
  const session = useSession();
  const tariff = byId(tariffs, chosen) ?? tariffs[0];
  const signedIn = session.status === "user" && session.email === normalizeEmail(email);

  // Чек восстанавливается по своему адресу: раньше он жил только в состоянии формы, и после F5
  // или «Назад» человек вместо подтверждения оплаты видел форму покупки — иногда с чужой датой.
  useEffect(() => {
    // список матриц нужен, чтобы восстановить оплаченную дату по её номеру
    if (!receipt || stage.kind === "paid" || session.status !== "user" || saved === null) return;
    let alive = true;
    api
      .payments()
      .then((res) => {
        if (!alive) return;
        // возвращённый платёж чеком больше не считается: страница писала «Доступ открыт»
        // и вела на закрытый разбор
        const hit = res.items.find(
          (x) => x.external_id === receipt && x.paid_at && !x.refunded_at && x.state !== "refunded",
        );
        if (!hit) {
          const back = res.items.find((x) => x.external_id === receipt && x.refunded_at);
          if (back) setError(D.payForm.errors.refunded[L]);
          send({ type: "receipt-missing" });
          return;
        }
        // список платежей отдаёт только номер даты, без самой записи: без этой досборки чек
        // терял оплаченную дату, и «Открыть полный разбор» вёл на чужой, неоплаченный разбор
        const row =
          hit.matrix ?? (saved ?? []).find((m) => m.id === hit.matrix_id) ?? null;
        send({
          type: "paid",
          paymentId: hit.external_id,
          email: session.email ?? "",
          matrix: row,
        });
      })
      .catch(() => {
        // Сеть отвалилась — форма предлагает оплатить уже оплаченное. Пока платёж не
        // проверен, показывать форму нельзя: F5 на чеке приводил к «Оплатить 250 ₽».
        if (!alive) return;
        send({ type: "receipt-unreachable" });
      });
    return () => {
      alive = false;
    };
  }, [receipt, stage.kind, session.status, session.email, saved]);

  // Цель pay_open уходит на открытии страницы: без неё воронка обрывается между
  // «нажал купить» и «оплатил», и тест трафика не показывает, где отваливаются.
  useEffect(() => {
    track("pay_open", { tariff: initial });
  }, [initial]);

  useEffect(() => {
    if (session.status === "user" && session.email) setEmail((v) => v || session.email!);
  }, [session.status, session.email]);

  // Список сохранённых дат нужен, чтобы человек выбрал, какую именно открыть. Гостю выбирать
  // нечего: у него есть только дата из браузера. Пока сессия не подтверждена, список остаётся
  // пустым (null): раньше «гость» выставлялся на время ожидания ответа, и цель успевала встать
  // на дату из браузера ещё до того, как приходили сохранённые записи.
  useEffect(() => {
    if (session.status === "loading") return;
    if (session.status !== "user") {
      setSaved([]);
      return;
    }
    api
      .matrices()
      .then((res) => setSaved(res.items))
      .catch(() => setSaved([]));
  }, [session.status]);

  const aimAt = usePayTarget({
    saved,
    birth,
    wanted,
    guest: session.status === "guest",
  });
  const { target, choices, opened, needsLogin, missing } = aimAt;
  const chosenLabel = aimAt.label;
  const targetLoading = saved === null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const mail = normalizeEmail(email);
    const wrongMail = emailError(email);
    if (wrongMail) return setError(wrongMail);
    if (!agreed) return setError(D.payForm.errors.consent[L]);
    // Про чужую почту говорим раньше, чем про пароль: вошедшему человеку бессмысленно требовать
    // пароль от аккаунта, которым он не пользуется.
    if (session.status === "user" && session.email && session.email !== mail) {
      return setError(
        D.payForm.errors.otherAccount[L](session.email ?? ""),
      );
    }
    const typed = password;
    if (!signedIn && typed.length < MIN_PASSWORD) {
      return setError(D.payForm.errors.shortPassword[L](MIN_PASSWORD));
    }
    const forAll = tariff.scope.includes("all");
    if (!forAll && target === null) {
      return setError(D.payForm.errors.noDate[L]);
    }

    setBusy(true);
    try {
      const live = session.status === "loading" ? await refreshSession() : session;
      if (live.status === "user" && live.email && live.email !== mail) {
        setError(
          D.payForm.errors.otherAccount[L](live.email ?? ""),
        );
        return;
      }


      // Доступ обязан работать с любого устройства, поэтому аккаунт создаётся до платежа —
      // с тем паролем, который ввели рядом с почтой.
      if (live.status !== "user") {
        try {
          await api.register(mail, typed);
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 400) throw err;
          // почта занята: если пароль от этого же аккаунта, это просто вход — и об этом
          // обязательно сказать, иначе человек думает, что создал новый аккаунт, а видит
          // прошлые матрицы и платежи
          try {
            await api.login(mail, typed);
            setSignedInto(mail);
            // без обновления снимка сессии форма оставалась гостевой: шапка звала «Войти»,
            // список матриц не читался, и отказ «эта дата уже открыта» повторялся бесконечно
            await refreshSession();
          } catch (loginErr) {
            if (loginErr instanceof ApiError && loginErr.status === 401) {
              send({ type: "password-needed", email: mail });
              setError(
                D.payForm.errors.wrongPassword[L],
              );
              return;
            }
            throw loginErr;
          }
        }
      }

      // Платим ровно за то, что напечатано на кнопке: цель одна на список, надпись и запрос.
      const aim =
        target === null || forAll
          ? undefined
          : target.kind === "matrix"
            ? { matrixId: target.id }
            : birth
              ? { birth: birth.birth, sex: birth.sex }
              : undefined;
      if (!forAll && !aim) {
        setError(D.payForm.errors.noDate[L]);
        return;
      }
      const res = await api.payStart(tariff.id, mail, aim);
      if (res.payment_url) {
        window.location.href = res.payment_url;
        return;
      }
      track("purchase", { tariff: tariff.id });
      await refreshSession();
      send({ type: "paid", paymentId: res.payment_id, email: mail, matrix: res.matrix });
      // Кеш сегментов держит страницы, напечатанные до оплаты: без сброса «назад» возвращал
      // разбор с замками. Адрес с `paid` отделяет чек от формы.
      router.replace(`${here}?paid=${encodeURIComponent(res.payment_id)}`, { scroll: false });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const tail = D.payForm.errors.notCharged[L];
        if (err.status === 401) {
          send({ type: "password-needed", email: mail });
          setError(D.payForm.errors.sessionExpired[L] + tail);
          return;
        }
        // 409 — не отказ платежа, а отказ повторной покупки: про деньги здесь говорить нечего
        if (err.status === 409) {
          setError(err.message.replace(/[.!…]?$/, "."));
          void refreshSession();
          return;
        }
        setError(
          // ответ не дошёл — значит про деньги мы ничего не знаем: платёж мог пройти,
          // и обещание «не списаны» оказывалось ложью
          err.status === 0
            ? D.payForm.errors.noAnswer[L]
            : err.message.replace(/[.!…]?$/, ".") + tail,
        );
      } else {
        setError(D.payForm.errors.generic[L]);
      }
    } finally {
      setBusy(false);
    }
  };

  if (stage.kind === "unchecked") {
    return <PayUnchecked paymentId={receipt} />;
  }

  if (stage.kind === "paid" && receipt) {
    return (
      <PayReceipt
        stage={stage}
        tariffName={tariff.name}
        test={test}
        signedInto={signedInto}
      />
    );
  }

  const known = needsOwnerPassword(stage, email);

  return (
    // Проверку почты ведёт lib/email: она строже браузерной и называет причину. С нативной
    // валидацией submit гасился раньше нашего обработчика, и адрес с невидимым символом из
    // копипаста получал отказ без объяснения.
    <form method="post" className="panel paybox" data-testid="pay-modal" onSubmit={submit}
          noValidate>
      <h3>{D.payForm.whatWeBuy[L]}</h3>
      <div className="cap">
        {tariffs.length > 1 ? D.payForm.manyPlans[L] : D.payForm.onePlan[L](priceLabel(tariff))}
      </div>

      {/* выбор не рисуем вовсе, пока продаём один тариф: скрытый стилями блок оставлял бы
          в разметке подписи вроде «Подписка» и «Одна дата» */}
      {tariffs.length > 1 ? (
      <div className="tchoice" role="radiogroup" aria-label={D.payForm.planGroup[L]} data-testid="tariff-choice">
        {tariffs.map((t) => (
          <label className={t.id === tariff.id ? "topt on" : "topt"} key={t.id}>
            <input
        disabled={!hydrated}
              type="radio"
              name="tariff"
              value={t.id}
              data-testid={`tariff-${t.id}`}
              checked={t.id === tariff.id}
              onChange={() => {
                setChosen(t.id);
                setError(null);
                track("tariff_select", { tariff: t.id });
              }}
            />
            <span>
              <span className="tname">{t.name}</span>
              <span className="tsub">{optionNote(t)}</span>
            </span>
            <span className="tprice">
              {priceLabel(t)}
              <s>{capLabel(t)}</s>
            </span>
          </label>
        ))}
      </div>
      ) : null}

      {!tariff.scope.includes("all") ? (
        <div className="paytarget">
          <label htmlFor="paytarget">{D.payForm.paymentOpens[L]}</label>
          <select
            id="paytarget"
            data-testid="pay-target"
            aria-busy={targetLoading}
            value={targetValue(target)}
            onChange={(e) => aimAt.choose(e.target.value)}
          >
            {target === null ? (
              <option value="none">{targetLoading ? D.payForm.checkingDate[L] : D.payForm.noDateChosen[L]}</option>
            ) : null}
            {choices.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="hint" style={{ textAlign: "left" }}>
            {targetLoading ? (
              <span className="skeleton" data-testid="pay-target-loading">
                {D.payForm.checkingLink[L]}
              </span>
            ) : needsLogin && target === null ? (
              <span data-testid="pay-login-note">
                {D.payForm.loginForDate[L]}{" "}
                <Link href="/login">{D.unlockBox.signIn[L].toLowerCase()}</Link>
                {D.payForm.loginForDateTail[L]}{" "}
                <Link href="/">{D.payForm.calcOnHome[L]}</Link>.
              </span>
            ) : target === null && opened ? (
              <span data-testid="pay-open-note">
                {D.payForm.alreadyOpen[L](opened.title ?? birthLabel(opened.birth))}{" "}
                <Link href={`/report?m=${opened.id}`}>{D.payForm.openReading[L]}</Link>.{" "}
                {D.payForm.anotherDate[L]} <Link href="/">{D.payForm.calcOnHome[L]}</Link>.
              </span>
            ) : target === null && missing ? (
              <span data-testid="pay-missing-note">
                {D.payForm.missingDate[L]}{" "}
                <Link href="/">{D.payForm.calcItOnHome[L]}</Link>.
              </span>
            ) : target === null ? (
              <>
                {D.payForm.noDateChosenHint[L]}{" "}
                <Link href="/">{D.payForm.enterOnHome[L]}</Link> {D.payForm.freeCalc[L]}
              </>
            ) : (
              D.payForm.willOpen[L](chosenLabel ?? "")
            )}
          </p>
        </div>
      ) : null}

      {signedIn ? (
        <>
          <label htmlFor="payemail" style={{ marginTop: 16 }}>
            {D.payForm.emailLabel[L]}
          </label>
          <input
        disabled={!hydrated}
            id="payemail"
            data-testid="pay-email"
        maxLength={200}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setError(null);
              setEmail(e.target.value);
            }}
            placeholder="you@mail.ru"
          />
          <p className="hint">{D.payForm.signedInAs[L](session.email ?? "")}</p>
        </>
      ) : (
        <>
          {/* Пароль спрашиваем сразу рядом с почтой: доступ живёт в аккаунте, и войти с другого
              устройства без пароля нельзя. */}
          <div className="payfields">
            <div>
              <label htmlFor="payemail">{D.payForm.emailLabel[L]}</label>
              <input
        disabled={!hydrated}
                id="payemail"
                data-testid="pay-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setError(null);
                  setEmail(e.target.value);
                  // требование пароля от чужого аккаунта снимается сменой почты
                  send({ type: "email-changed", email: e.target.value });
                }}
                placeholder="you@mail.ru"
              />
            </div>
            <div>
              <label htmlFor="paypass">
                {known ? D.payForm.passwordKnown[L] : D.payForm.passwordNew[L]}
              </label>
              <input
        disabled={!hydrated}
                id="paypass"
                data-testid="pay-password"
        maxLength={200}
                name="password"
                type="password"
                autoComplete={known ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => {
                  setError(null);
                  setPassword(e.target.value);
                }}
                placeholder={known
                  ? D.payForm.passwordPlaceholderKnown[L]
                  : D.payForm.passwordPlaceholderNew[L](MIN_PASSWORD)}
              />
            </div>
          </div>
          <p className="hint" style={{ textAlign: "left" }}>
            {known
              ? (
                <>
                  {D.payForm.accountExists[L]}{" "}
                  <Link href="/forgot">{D.payForm.restorePassword[L]}</Link>.
                </>
              )
              : D.payForm.newPairHint[L]}
          </p>
        </>
      )}

      <label className="consent">
        <input
          type="checkbox"
          disabled={!hydrated}
          checked={agreed}
          onChange={(e) => {
            setError(null);
            setAgreed(e.target.checked);
          }}
        />
        <span>
          {D.payForm.consentHead[L]}{" "}
          <Link href="/privacy" target="_blank" rel="noopener">{D.payForm.consentPolicy[L]}</Link>
          {D.payForm.consentAccept[L]}{" "}
          <Link href="/terms" target="_blank" rel="noopener">{D.payForm.consentTerms[L]}</Link>{" "}
          {D.payForm.consentAnd[L]}{" "}
          <Link href="/refund" target="_blank" rel="noopener">{D.payForm.consentRefund[L]}</Link>.
        </span>
      </label>

      {/* Без цели платить нечего: кнопка гасится, а не отказывает после списания. */}
      <button
        className="btn wide"
        data-testid="pay-submit"
        style={{ marginTop: 14 }}
        disabled={busy || (!tariff.scope.includes("all") && target === null) || !hydrated}
      >
        {!hydrated
          ? D.payForm.preparing[L]
          : busy
          ? D.payForm.processing[L]
          : D.payForm.payButton[L](
              priceLabel(tariff),
              tariff.scope.includes("all") || chosenLabel === null ? "" : ` · ${chosenLabel}`,
            )}
      </button>

      {error ? <div className="err" role="alert" aria-live="assertive">{error}</div> : null}
      {signedInto ? (
        <p className="hint" data-testid="signed-into" style={{ textAlign: "left" }}>
          {D.payForm.signedIntoExisting[L](signedInto)}
        </p>
      ) : null}
      <p className="hint">{D.pay.privacyNote[L]}</p>
    </form>
  );
}
