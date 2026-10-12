"use client";

import { forLocale as localizedUseSession, useSession } from "@/components/account/useSession";
import { useOfferMode } from "@/components/pay/useOfferMode";
import { forLocale as localizedMatrixResult } from "@/components/matrix/MatrixResult";
import { useLocale } from "@/components/ui/LocaleProvider";
import { track, trackPurchase } from "@/lib/analytics";
import { ApiError, forLocale as localizedApi, type MatrixListItem } from "@/lib/api";
import { emailProblem, forLocale as localizedEmail } from "@/lib/email";
import { reportFormCheck } from "@/lib/errors";
import { useHydrated } from "@/lib/hydrated";
import { D, forLocale as localizedI18n } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { useMessage } from "@/lib/i18n/useMessage";
import { forLocale as localizedPayStage, type PayEvent, type Stage } from "@/lib/payStage";
import { forLocale as localizedTariffs, type Tariff, type PaymentProvider } from "@/lib/tariffs";
import { useBirth } from "@/lib/useBirth";
import { forLocale as localizedMatrix, MatrixError, type Sex } from "@/lib/matrix";
import { forLocale as localizedTargets } from "@/lib/paytarget";
import { pairTitle } from "@/lib/pair/title";
import { saveBirth, savePair, type StoredBirth, type StoredPair } from "@/lib/storage";
import { BirthPicker, PairPicker, isoOf, type PickedDate } from "./BirthPicker";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PayReceipt from "./PayReceipt";
import PayUnchecked from "./PayUnchecked";
import { Subscribed } from "./Subscribed";
import { DP } from "@/lib/i18n/dict/pair";
import { usePairTarget } from "./usePairTarget";
import { usePayTarget } from "./usePayTarget";

export const forLocale = localized((L: Locale) => {
  const { api } = localizedApi(L);
  const { emailError, normalizeEmail } = localizedEmail(L);
  const { needsOwnerPassword, reduce, START } = localizedPayStage(L);
  const { byId, capLabel, money, periodLabel, priceLabel } = localizedTariffs(L);
  const { birthLabel } = localizedMatrixResult(L);
  const { refreshSession } = localizedUseSession(L);

  const MIN_PASSWORD = 3;

  /** Что даёт тариф — выводим из полей предложения, а не из списка в разметке: его правят в базе. */
  function optionNote(t: Tariff, product = "personal"): string {
    const any = t.per_reading === false || t.scope.includes("all");
    const parts = [any
      ? (t.products?.includes("*") ? D.payForm.anyReadings[L] : D.payForm.anyDates[L])
      : product === "pair" ? D.payForm.onePair[L] : D.payForm.oneDate[L]];
    if (t.scope.includes("matrix")) parts.push(D.payForm.storedInAccount[L]);
    // «навсегда» на витрине спорило с офертой («не менее 12 месяцев»): обещаем то, что
    // выполняем — доступ без подписки и файл, который остаётся у человека
    parts.push(t.period_days === null
      ? D.payForm.noSubscription[L]
      : D.payForm.openedUntil[L](periodLabel(t)));
    return parts.join(" · ");
  }
  return { api, emailError, normalizeEmail, needsOwnerPassword, reduce, START, byId, capLabel, money, periodLabel, priceLabel, birthLabel, refreshSession, MIN_PASSWORD, optionNote };
});

export default function PayForm({ locale: requestedLocale, ...localeProps }: ({
  tariffs: Tariff[]; initial: string; providers: PaymentProvider[]
  /** деньги ненастоящие: предупреждение показываем только тогда */
  test?: boolean;
  /** чей разбор продаёт экран: от него зависит, что выбирают целью платежа */
  product?: string;
}) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { tariffs, initial, providers, test = false, product = "personal" } = localeProps;
  const isPair = product === "pair";
  const { api, emailError, normalizeEmail, needsOwnerPassword, reduce, START, byId, capLabel, periodLabel, priceLabel, birthLabel, refreshSession, MIN_PASSWORD, optionNote } = forLocale(L);

  const [provider, setProvider] = useState(providers[0]?.id);
  const [chosen, setChosen] = useState(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useMessage(L);
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
  const mode = useOfferMode(product);
  const tariff = byId(tariffs, chosen) ?? tariffs[0];
  // вошедшему почту не спрашиваем: платёж идёт в его аккаунт
  const signedIn = session.status === "user" && Boolean(session.email);

  // Чек по адресу не найден или возвращён: дальше это обычная страница оплаты. Проверка больше
  // не повторяется — иначе обновление сессии после отказа снова писало «платёж возвращён»
  // поверх ответа сервера, и кнопка выглядела сломанной.
  const [receiptGone, setReceiptGone] = useState(false);
  useEffect(() => setReceiptGone(false), [receipt]);

  // Чек восстанавливается по своему адресу: раньше он жил только в состоянии формы, и после F5
  // или «Назад» человек вместо подтверждения оплаты видел форму покупки — иногда с чужой датой.
  useEffect(() => {
    // список матриц нужен, чтобы восстановить оплаченную дату по её номеру
    if (!receipt || receiptGone || stage.kind === "paid" || session.status !== "user" || saved === null) return;
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
          if (back) setError((locale) => D.payForm.errors.refunded[locale]);
          setReceiptGone(true);
          send({ type: "receipt-missing" });
          return;
        }
        // список платежей отдаёт только номер даты, без самой записи: без этой досборки чек
        // терял оплаченную дату, и «Открыть полный разбор» вёл на чужой, неоплаченный разбор
        const row =
          hit.reading ?? hit.matrix ?? (saved ?? []).find((m) => m.id === hit.matrix_id) ?? null;
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
  }, [receipt, receiptGone, stage.kind, session.status, session.email, saved]);

  // Цель pay_open уходит на открытии страницы: без неё воронка обрывается между
  // «нажал купить» и «оплатил», и тест трафика не показывает, где отваливаются.
  useEffect(() => {
    track("pay_open", { tariff: initial });
  }, [initial]);

  useEffect(() => {
    if (session.status === "user" && session.email) setEmail(session.email);
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
  }, [session.status, api]);

  const aimAt = usePayTarget({
    saved,
    birth,
    wanted,
    guest: session.status === "guest",
  });
  const { target, needsLogin } = aimAt;
  const wantedPair = Number(params.get("r") ?? "") || null;
  const pairAim = usePairTarget({
    enabled: isPair,
    signedIn: session.status === "loading" ? null : session.status === "user",
    wanted: wantedPair,
  });
  const forAll = tariff.per_reading === false || tariff.scope.includes("all");

  // Платёж открывает то, что стоит в полях. Поля начинаются с даты, с которой пришли: сохранённой
  // по ссылке `?m=` или выбранной на главной; дальше человек меняет их сам.
  const { calculate, daysInMonth } = localizedMatrix(L);
  const { alreadyOpen } = localizedTargets(L);
  const [person, setPerson] = useState<{ date: PickedDate; sex: Sex } | null>(null);
  const [couple, setCouple] = useState<{ a: PickedDate; b: PickedDate } | null>(null);
  const targetRow = target?.kind === "matrix" ? (saved ?? []).find((row) => row.id === target.id) ?? null : null;
  // ссылка на уже открытую дату ставит в поля её же: форма скажет, что платить незачем
  const askedRow = targetRow ?? aimAt.opened;
  const initialBirth = useMemo<StoredBirth | null>(
    () => (askedRow ? { birth: askedRow.birth, sex: askedRow.sex } : birth),
    [askedRow?.birth, askedRow?.sex, birth],
  );
  const entered: StoredBirth | null = person ? { birth: isoOf(person.date), sex: person.sex } : null;
  const enteredOpen = entered ? alreadyOpen(saved ?? [], entered) : null;
  const pairKey = (pair: StoredPair) => [pair.a.birth, pair.b.birth].sort().join("|");
  const enteredPair: StoredPair | null = (() => {
    if (!couple) return null;
    const a = isoOf(couple.a), b = isoOf(couple.b);
    const from = pairAim.initial;
    const same = from && from.a.birth === a && from.b.birth === b;
    return { a: { birth: a, ...(same && from.a.name ? { name: from.a.name } : {}) },
      b: { birth: b, ...(same && from.b.name ? { name: from.b.name } : {}) } };
  })();
  const pairRow = (pair: StoredPair | null) => pair
    ? pairAim.rows.find((row) => pairKey(row.inputs as unknown as StoredPair) === pairKey(pair)) ?? null : null;
  const enteredPairRow = pairRow(enteredPair);
  const enteredPairOpen = enteredPairRow && enteredPairRow.access !== "locked" ? enteredPairRow : null;
  const enteredRow = targetRow && entered && targetRow.birth === entered.birth && targetRow.sex === entered.sex
    ? targetRow : null;
  const chosenLabel = isPair
    ? (enteredPair ? pairTitle(L, enteredPair.a, enteredPair.b) : null)
    : (entered ? enteredRow?.title || birthLabel(entered.birth) : null);
  // пока не пришли сохранённые даты, поля стоят на примере: платёж ушёл бы не за ту дату
  const targetLoading = !forAll && (isPair ? pairAim.loading : saved === null);
  // ссылка на запись из кабинета, а человек не вошёл: подставлять вместо неё дату из браузера нельзя
  const loginFirst = !forAll && (isPair
    ? wantedPair !== null && session.status === "guest"
    : needsLogin && target === null);
  // что откроет платёж: номер сохранённого разбора, дата из браузера («local») или новая дата
  const local = pairAim.initial && !pairAim.rows.some((row) => pairKey(row.inputs as unknown as StoredPair) === pairKey(pairAim.initial!));
  const aimValue = isPair
    ? (enteredPairRow ? String(enteredPairRow.id) : local && enteredPair && pairKey(enteredPair) === pairKey(pairAim.initial!) ? "local" : "pair")
    : (enteredRow
      ? String(enteredRow.id)
      : birth && entered && birth.birth === entered.birth && birth.sex === entered.sex ? "local" : "date");

  /** Ошибка введённой даты тем же текстом, что в калькуляторе; null — всё верно. */
  function dateProblem(dates: PickedDate[]): ((locale: Locale) => string) | null {
    for (const d of dates) {
      const maxDay = daysInMonth(d.year, d.month);
      if (d.day > maxDay) return (locale) => D.calc.tooManyDays[locale](maxDay);
      try {
        calculate(isoOf(d), "f");
      } catch (e) {
        return (locale) => (e instanceof MatrixError ? e.messageFor(locale) : D.calc.genericError[locale]);
      }
    }
    return null;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const raw = signedIn ? session.email! : email;
    const mail = normalizeEmail(raw);
    const wrongMail = emailError(raw);
    if (wrongMail) {
      reportFormCheck("pay", `email:${emailProblem(mail)}`);
      return setError((locale) => localizedEmail(locale).emailError(raw));
    }
    if (!signedIn && !agreed) {
      reportFormCheck("pay", "consent");
      return setError((locale) => D.payForm.errors.consent[locale]);
    }
    // Про чужую почту говорим раньше, чем про пароль: вошедшему человеку бессмысленно требовать
    // пароль от аккаунта, которым он не пользуется.
    if (session.status === "user" && session.email && session.email !== mail) {
      reportFormCheck("pay", "other-account");
      return setError(
        (locale) => D.payForm.errors.otherAccount[locale](session.email ?? ""),
      );
    }
    const typed = password;
    if (!signedIn && typed.length < MIN_PASSWORD) {
      reportFormCheck("pay", "password:short");
      return setError((locale) => D.payForm.errors.shortPassword[locale](MIN_PASSWORD));
    }
    if (!forAll) {
      const dates = isPair ? (couple ? [couple.a, couple.b] : []) : person ? [person.date] : [];
      if (!dates.length) {
        reportFormCheck("pay", "no-date");
        return setError((locale) => D.payForm.errors.noDate[locale]);
      }
      const problem = dateProblem(dates);
      if (problem) {
        reportFormCheck("pay", "date");
        return setError(problem);
      }
    }

    setBusy(true);
    try {
      const live = session.status === "loading" ? await refreshSession() : session;
      if (live.status === "user" && live.email && live.email !== mail) {
        setError(
          (locale) => D.payForm.errors.otherAccount[locale](live.email ?? ""),
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
                (locale) => D.payForm.errors.wrongPassword[locale],
              );
              return;
            }
            throw loginErr;
          }
        }
      }

      // Платим ровно за то, что напечатано на кнопке: цель одна на список, надпись и запрос.
      const aim = forAll
        ? undefined
        : isPair
          ? (enteredPairRow ? { readingId: enteredPairRow.id } : enteredPair ? { inputs: enteredPair } : undefined)
          : !entered
            ? undefined
            : targetRow && targetRow.birth === entered.birth && targetRow.sex === entered.sex
              ? { matrixId: targetRow.id }
              : { birth: entered.birth, sex: entered.sex };
      if (!forAll && isPair && enteredPair) savePair(enteredPair);
      if (!forAll && !isPair && entered) saveBirth(entered);
      if (!forAll && !aim) {
        setError((locale) => D.payForm.errors.noDate[locale]);
        return;
      }
      const res = await api.payStart(tariff.id, mail, aim, provider);
      if (res.payment_url) {
        window.location.href = res.payment_url;
        return;
      }
      trackPurchase(res.payment_id, { tariff: tariff.id });
      await refreshSession();
      send({ type: "paid", paymentId: res.payment_id, email: mail, matrix: res.matrix });
      // Кеш сегментов держит страницы, напечатанные до оплаты: без сброса «назад» возвращал
      // разбор с замками. Адрес с `paid` отделяет чек от формы.
      router.replace(`${here}?paid=${encodeURIComponent(res.payment_id)}`, { scroll: false });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          send({ type: "password-needed", email: mail });
          setError((locale) => D.payForm.errors.sessionExpired[locale] + D.payForm.errors.notCharged[locale]);
          return;
        }
        // 409 — не отказ платежа, а отказ повторной покупки: про деньги здесь говорить нечего
        if (err.status === 409) {
          setError((locale) => err.messageFor(locale).replace(/[.!…]?$/, "."));
          void refreshSession();
          return;
        }
        setError(
          // ответ не дошёл — значит про деньги мы ничего не знаем: платёж мог пройти,
          // и обещание «не списаны» оказывалось ложью
          (locale) => err.status === 0
            ? D.payForm.errors.noAnswer[locale]
            : err.messageFor(locale).replace(/[.!…]?$/, ".") + D.payForm.errors.notCharged[locale],
        );
      } else {
        setError((locale) => D.payForm.errors.generic[locale]);
      }
    } finally {
      setBusy(false);
    }
  };

  if (stage.kind === "unchecked") {
    return <PayUnchecked locale={L} paymentId={receipt} />;
  }

  if (stage.kind === "paid" && receipt) {
    return (
      <PayReceipt locale={L}
        stage={{ ...stage, matrix: saved?.find((row) => row.id === stage.matrix?.id) ?? stage.matrix }}
        tariffName={tariff.name}
        test={test}
        signedInto={signedInto}
        subscription={forAll}
      />
    );
  }

  const known = needsOwnerPassword(stage, email);

  // Подписка уже открывает этот продукт: формы покупки нет, есть путь к разборам.
  if (mode === "subscription" && !busy && (!receipt || receiptGone)) {
    return <Subscribed locale={L} pair={isPair} />;
  }

  return (
    // Проверку почты ведёт lib/email: она строже браузерной и называет причину. С нативной
    // валидацией submit гасился раньше нашего обработчика, и адрес с невидимым символом из
    // копипаста получал отказ без объяснения.
    <form method="post" className="panel paybox" data-testid="pay-modal" onSubmit={submit}
      noValidate>
      {providers.length > 1 && <label className="field">
        <span>{D.pay.paymentMethod[L]}</span>
        <select value={provider} onChange={(event) => setProvider(event.target.value)} disabled={busy}>
          {providers.map((item) => <option key={item.id} value={item.id}>
            {item.provider === "tbank" ? D.pay.tbank[L] : item.provider === "mock" ? D.pay.mock[L] : item.provider}
          </option>)}
        </select>
      </label>}

      <h3>{D.payForm.whatWeBuy[L]}</h3>
      <div className="cap">
        {tariffs.length > 1
          ? (isPair ? D.payForm.manyPlansPair[L] : D.payForm.manyPlans[L])
          : forAll
            ? D.payForm.onePlanAll[L](priceLabel(tariff), periodLabel(tariff), tariff.products?.includes("*") ?? false)
            : isPair ? D.payForm.onePlanPair[L](priceLabel(tariff)) : D.payForm.onePlan[L](priceLabel(tariff))}
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
                <span className="tsub">{optionNote(t, product)}</span>
              </span>
              <span className="tprice">
                {priceLabel(t)}
                <s>{capLabel(t)}</s>
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {!forAll && isPair ? (
        <div className="paytarget" data-testid="pay-target" data-value={aimValue}>
          <p className="paytarget-l">{D.payForm.paymentOpens[L]}</p>
          {loginFirst ? null : (
            <PairPicker locale={L} initial={pairAim.initial} ready={!pairAim.loading} disabled={!hydrated || targetLoading}
              onChange={(value) => { setError(null); setCouple(value); }} />
          )}
          <p className="hint" style={{ textAlign: "left" }} data-testid="pay-target-note">
            {targetLoading ? (
              <span className="skeleton" data-testid="pay-target-loading">{D.payForm.checkingDate[L]}</span>
            ) : loginFirst ? (
              <span data-testid="pay-login-note">
                {D.payForm.loginForPair[L]}{" "}
                <Link href="/login">{D.unlockBox.signIn[L].toLowerCase()}</Link>
                {D.payForm.loginForPairTail[L]}{" "}
                <Link href={here}>{D.payForm.pickWithoutLogin[L]}</Link>.
              </span>
            ) : enteredPairOpen ? (
              <span data-testid="pay-open-note">
                {D.payForm.alreadyOpen[L](enteredPairOpen.title ?? chosenLabel ?? "")}{" "}
                <Link href={`/readings/${enteredPairOpen.id}`}>{D.payForm.openReading[L]}</Link>.
              </span>
            ) : chosenLabel ? D.payForm.willOpen[L](chosenLabel) : null}
          </p>
        </div>
      ) : null}

      {!forAll && !isPair ? (
        <div className="paytarget" data-testid="pay-target" data-value={aimValue}>
          <p className="paytarget-l">{D.payForm.paymentOpens[L]}</p>
          {loginFirst ? null : (
            <BirthPicker locale={L} initial={initialBirth} ready={saved !== null} disabled={!hydrated || targetLoading}
              onChange={(value) => { setError(null); setPerson(value); }} />
          )}
          <p className="hint" style={{ textAlign: "left" }} data-testid="pay-target-note">
            {targetLoading ? (
              <span className="skeleton" data-testid="pay-target-loading">
                {wanted !== null ? D.payForm.checkingLink[L] : D.payForm.checkingDate[L]}
              </span>
            ) : loginFirst ? (
              <span data-testid="pay-login-note">
                {D.payForm.loginForDate[L]}{" "}
                <Link href="/login">{D.unlockBox.signIn[L].toLowerCase()}</Link>
                {D.payForm.loginForDateTail[L]}{" "}
                <Link href={here}>{D.payForm.pickWithoutLogin[L]}</Link>.
              </span>
            ) : enteredOpen ? (
              <span data-testid="pay-open-note">
                {D.payForm.alreadyOpen[L](enteredOpen.title ?? birthLabel(enteredOpen.birth))}{" "}
                <Link href={`/report?m=${enteredOpen.id}`}>{D.payForm.openReading[L]}</Link>.
              </span>
            ) : chosenLabel ? D.payForm.willOpen[L](chosenLabel) : null}
          </p>
        </div>
      ) : null}

      {session.status === "loading" ? null : signedIn ? (
        <p className="hint" style={{ marginTop: 16, textAlign: "left" }} data-testid="pay-account">
          {D.payForm.signedInAs[L](session.email ?? "")}
        </p>
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

      {session.status === "loading" ? null : signedIn ? (
        // Договор заключается оплатой (оферта, раздел 4), а согласие на данные человек дал при
        // регистрации или первой покупке: вторая галочка ему не нужна.
        <p className="hint" style={{ textAlign: "left" }} data-testid="pay-terms">
          {D.payForm.termsByPaying[L]}{" "}
          <Link href="/terms" target="_blank" rel="noopener">{D.payForm.consentTerms[L]}</Link>{" "}
          {D.payForm.consentAnd[L]}{" "}
          <Link href="/refund" target="_blank" rel="noopener">{D.payForm.consentRefund[L]}</Link>.
        </p>
      ) : (
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
      )}

      {/* Уже открытое второй раз не продаём: кнопка гасится, а не отказывает после списания. */}
      <button
        className="btn wide"
        data-testid="pay-submit"
        style={{ marginTop: 14 }}
        disabled={busy || targetLoading || loginFirst || (!forAll && (isPair ? !!enteredPairOpen : !!enteredOpen)) || !hydrated}
      >
        {!hydrated
          ? D.payForm.preparing[L]
          : busy
            ? D.payForm.processing[L]
            : D.payForm.payButton[L](
              priceLabel(tariff),
              forAll || loginFirst || chosenLabel === null ? "" : ` · ${chosenLabel}`,
            )}
      </button>

      {error ? <div className="err" role="alert" aria-live="assertive">{error}</div> : null}
      {signedInto ? (
        <p className="hint" data-testid="signed-into" style={{ textAlign: "left" }}>
          {D.payForm.signedIntoExisting[L](signedInto)}
        </p>
      ) : null}
    </form>
  );
}
