"use client";

import { useHydrated } from "@/lib/hydrated";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, api, type MatrixListItem } from "@/lib/api";
import { track } from "@/lib/analytics";
import { needsOwnerPassword, reduce, START, type PayEvent, type Stage } from "@/lib/payStage";
import { useBirth } from "@/lib/useBirth";
import { byId, capLabel, money, periodLabel, type Tariff } from "@/lib/tariffs";

import { birthLabel } from "@/components/matrix/MatrixResult";
import PayReceipt from "./PayReceipt";
import PayUnchecked from "./PayUnchecked";
import { usePayTarget, targetValue } from "./usePayTarget";
import { refreshSession, useSession } from "@/components/account/useSession";


const MIN_PASSWORD = 3;

/** Что даёт тариф — выводим из scope, а не из списка в разметке: тариф правят в базе. */
function optionNote(t: Tariff): string {
  const parts = [t.scope.includes("all") ? "любое число дат" : "одна дата"];
  if (t.scope.includes("matrix")) parts.push("матрицы хранятся в кабинете");
  // «навсегда» на витрине спорило с офертой («не менее 12 месяцев»): обещаем то, что
  // выполняем — доступ без подписки и файл, который остаётся у человека
  parts.push(t.period_days === null
    ? "без подписки: открыт в аккаунте и скачивается в PDF"
    : `открыто ${periodLabel(t)}, потом закрывается`);
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
  const signedIn = session.status === "user" && session.email === email.trim().toLowerCase();

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
          if (back) setError("Этот платёж возвращён: доступ по нему закрыт.");
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
    const mail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setError("Проверьте адрес почты.");
    if (!agreed) return setError("Нужно согласие на обработку персональных данных.");
    // Про чужую почту говорим раньше, чем про пароль: вошедшему человеку бессмысленно требовать
    // пароль от аккаунта, которым он не пользуется.
    if (session.status === "user" && session.email && session.email !== mail) {
      return setError(
        `Вы вошли как ${session.email}: тариф начислится этому аккаунту. Чтобы оплатить на другую ` +
          "почту, сначала выйдите из аккаунта.",
      );
    }
    const typed = password;
    if (!signedIn && typed.length < MIN_PASSWORD) {
      return setError(`Пароль для входа — не короче ${MIN_PASSWORD} знаков.`);
    }
    const forAll = tariff.scope.includes("all");
    if (!forAll && target === null) {
      return setError("Сначала введите дату рождения — платёж открывает конкретную дату.");
    }

    setBusy(true);
    try {
      const live = session.status === "loading" ? await refreshSession() : session;
      if (live.status === "user" && live.email && live.email !== mail) {
        setError(
          `Вы вошли как ${live.email}: тариф начислится этому аккаунту. Чтобы оплатить на другую ` +
            "почту, сначала выйдите из аккаунта.",
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
                "На эту почту уже есть аккаунт, и этот пароль к нему не подошёл. Введите пароль " +
                  "аккаунта или восстановите его — ссылка «Восстановить пароль» под формой. " +
                  "Тариф начислится этому аккаунту.",
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
        setError("Сначала введите дату рождения — платёж открывает конкретную дату.");
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
        const tail = " Платёж не прошёл — деньги не списаны.";
        if (err.status === 401) {
          send({ type: "password-needed", email: mail });
          setError("Сессия истекла — введите пароль аккаунта ещё раз." + tail);
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
            ? "Ответ от сервера не дошёл. Если платёж всё же прошёл, разбор уже открыт — " +
              "обновите страницу; второй раз за ту же дату списать не получится."
            : err.message.replace(/[.!…]?$/, ".") + tail,
        );
      } else {
        setError("Что-то пошло не так. Попробуйте ещё раз.");
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
    <form method="post" className="panel paybox" data-testid="pay-modal" onSubmit={submit}>
      <h3>Что покупаем</h3>
      <div className="cap">
        {tariffs.length > 1
          ? "Все 20 разделов разбора открывает любой из тарифов — разница в числе дат и сроке."
          : `Все 20 разделов разбора по одной дате рождения. Стоимость — ${money(tariff.price)} ₽, ` +
            "один платёж без подписки; разбор скачивается в PDF."}
      </div>

      {/* выбор не рисуем вовсе, пока продаём один тариф: скрытый стилями блок оставлял бы
          в разметке подписи вроде «Подписка» и «Одна дата» */}
      {tariffs.length > 1 ? (
      <div className="tchoice" role="radiogroup" aria-label="Тариф" data-testid="tariff-choice">
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
              {`${money(t.price)} ₽`}
              <s>{capLabel(t)}</s>
            </span>
          </label>
        ))}
      </div>
      ) : null}

      {!tariff.scope.includes("all") ? (
        <div className="paytarget">
          <label htmlFor="paytarget">Платёж откроет</label>
          <select
            id="paytarget"
            data-testid="pay-target"
            aria-busy={targetLoading}
            value={targetValue(target)}
            onChange={(e) => aimAt.choose(e.target.value)}
          >
            {target === null ? (
              <option value="none">{targetLoading ? "Проверяем дату…" : "Дата не выбрана"}</option>
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
                Проверяем дату из ссылки в вашем кабинете…
              </span>
            ) : needsLogin && target === null ? (
              <span data-testid="pay-login-note">
                Эта дата сохранена в аккаунте — <Link href="/login">войдите</Link>, чтобы открыть
                именно её. Другую дату можно <Link href="/">посчитать на главной</Link>.
              </span>
            ) : target === null && opened ? (
              <span data-testid="pay-open-note">
                Разбор «{opened.title ?? birthLabel(opened.birth)}» уже открыт
                — второй раз платить не нужно.{" "}
                <Link href={`/report?m=${opened.id}`}>Открыть разбор</Link>. Другую дату можно{" "}
                <Link href="/">посчитать на главной</Link>.
              </span>
            ) : target === null && missing ? (
              <span data-testid="pay-missing-note">
                Даты из ссылки в вашем кабинете нет: платёж за неё не пройдёт. Выберите дату из
                списка или <Link href="/">посчитайте её на главной</Link>.
              </span>
            ) : target === null ? (
              <>
                Дата не выбрана: платёж открывает конкретную дату.{" "}
                <Link href="/">Введите её на главной</Link> — расчёт бесплатный.
              </>
            ) : (
              `Откроется «${chosenLabel}». Платёжному провайдеру дата не передаётся.`
            )}
          </p>
        </div>
      ) : null}

      {signedIn ? (
        <>
          <label htmlFor="payemail" style={{ marginTop: 16 }}>
            Почта для доступа
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
          <p className="hint">Вы вошли как {session.email}: тариф начислится этому аккаунту.</p>
        </>
      ) : (
        <>
          {/* Пароль спрашиваем сразу рядом с почтой: доступ живёт в аккаунте, и войти с другого
              устройства без пароля нельзя. */}
          <div className="payfields">
            <div>
              <label htmlFor="payemail">Почта для доступа</label>
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
              <label htmlFor="paypass">{known ? "Пароль этого аккаунта" : "Пароль для входа"}</label>
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
                placeholder={known ? "ваш пароль" : `не короче ${MIN_PASSWORD} знаков`}
              />
            </div>
          </div>
          <p className="hint" style={{ textAlign: "left" }}>
            {known
              ? (
                <>
                  На эту почту уже есть аккаунт — нужен его пароль. Забыли?{" "}
                  <Link href="/forgot">Восстановить пароль</Link>.
                </>
              )
              : "С этой парой вход работает с любого устройства. На эту почту придёт письмо о покупке."}
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
          Согласен(на) на обработку персональных данных на условиях{" "}
          <Link href="/privacy" target="_blank" rel="noopener">политики</Link>, принимаю <Link href="/oferta" target="_blank" rel="noopener">оферту</Link> и{" "}
          <Link href="/refund" target="_blank" rel="noopener">условия возврата</Link>.
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
          ? "Готовим форму…"
          : busy
          ? "Проводим платёж…"
          : `Оплатить ${money(tariff.price)} ₽${
              tariff.scope.includes("all") || chosenLabel === null ? "" : ` · ${chosenLabel}`
            }`}
      </button>

      {error ? <div className="err" role="alert" aria-live="assertive">{error}</div> : null}
      {signedInto ? (
        <p className="hint" data-testid="signed-into" style={{ textAlign: "left" }}>
          Аккаунт на {signedInto} уже был — мы вошли в него, новый не создавали. Тариф начислен ему,
          поэтому в кабинете видны прежние матрицы и платежи.
        </p>
      ) : null}
      <p className="hint">
        Платёжному провайдеру дата рождения не передаётся: в ссылку оплаты она не попадает. Выбранная
        дата сохраняется в ваш кабинет — по ней сервер печатает платные разделы.
      </p>
    </form>
  );
}
