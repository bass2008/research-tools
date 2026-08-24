"use client";

import { useHydrated } from "@/lib/hydrated";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, api, type MatrixListItem, type PaymentResponse } from "@/lib/api";
import { track } from "@/lib/analytics";
import {
  alreadyOpen,
  fromValue,
  options as targetOptions,
  pickTarget,
  stillValid,
  targetLabel as labelOf,
  targetValue,
  type Target,
} from "@/lib/paytarget";
import { clearLead, loadBirth, loadLead, saveLead } from "@/lib/storage";
import { byId, capLabel, money, periodLabel, type Tariff } from "@/lib/tariffs";

import { birthLabel } from "./MatrixResult";
import { refreshSession, useSession } from "./useSession";

type Stage =
  | { kind: "form" }
  // почта уже зарегистрирована, а введённый пароль не подошёл: нужен пароль владельца
  | { kind: "login-needed" }
  | { kind: "paid"; paymentId: string; email: string; matrix: PaidMatrix | null };

type LeadState = "none" | "sent" | "kept";

type PaidMatrix = NonNullable<PaymentResponse["matrix"]>;

const MIN_PASSWORD = 3;

/** Что даёт тариф — выводим из scope, а не из списка в разметке: тариф правят в базе. */
function optionNote(t: Tariff): string {
  const parts = [t.scope.includes("all") ? "любое число дат" : "одна дата"];
  if (t.scope.includes("matrix")) parts.push("матрицы хранятся в кабинете");
  parts.push(t.period_days === null ? "остаётся навсегда" : `открыто ${periodLabel(t)}, потом закрывается`);
  return parts.join(" · ");
}

export default function PayForm({ tariffs, initial }: { tariffs: Tariff[]; initial: string }) {
  const [chosen, setChosen] = useState(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [lead, setLead] = useState<LeadState>("none");
  const [birth, setBirth] = useState<{ birth: string; sex: "m" | "f" } | null>(null);
  const [saved, setSaved] = useState<MatrixListItem[] | null>(null);
  const [target, setTarget] = useState<Target>(null);
  // человек сам выбрал в списке: с этого момента адрес его выбор не перебивает
  const [picked, setPicked] = useState(false);
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

  // Цель pay_open уходит на открытии страницы: без неё воронка обрывается между
  // «нажал купить» и «оплатил», и тест трафика не показывает, где отваливаются.
  useEffect(() => {
    track("pay_open", { tariff: initial });
    setBirth(loadBirth());
  }, [initial]);

  // Дата в браузере могла смениться, пока форма открыта: человек уходит считать другую и
  // возвращается назад, а Next восстанавливает состояние сегмента. Из-за этого платёж однажды
  // ушёл за прежнюю дату, поэтому дату перечитываем и на возврате к вкладке.
  useEffect(() => {
    const refresh = () => setBirth(loadBirth());
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // Лид, залёгший в браузере из-за отказа сети, уходит при следующем открытии формы —
  // иначе обещание «отправится сама» было бы ложью.
  useEffect(() => {
    const kept = loadLead();
    if (!kept) return;
    api
      .lead(kept.email, kept.tariff ? `pay:${kept.tariff}` : "pay")
      .then(() => clearLead())
      .catch(() => {
        /* сеть всё ещё лежит — почта остаётся в браузере */
      });
  }, []);

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

  const choices = saved === null ? [] : targetOptions(saved, birth);
  const chosenLabel = labelOf(target, saved ?? [], birth);
  const opened = alreadyOpen(saved ?? [], birth);
  // Ссылку «Открыть — 250 ₽» человек мог открыть на другом устройстве или после выхода. Номер
  // чужой сессии не принадлежит, поэтому вместо молчаливой подмены даты просим войти.
  const needsLogin = wanted !== null && session.status === "guest";

  // Цель считаем одной функцией и только по загруженному списку. Дата из адреса главнее уже
  // выбранной, пока человек не тронул список руками: ссылка «Открыть — 250 ₽» из кабинета обещает
  // конкретную дату, и платёж обязан уйти за неё.
  useEffect(() => {
    if (saved === null) return;
    if (needsLogin) {
      setTarget(null);
      return;
    }
    const list = targetOptions(saved, birth);
    const asked = wanted === null ? null : pickTarget(saved, birth, wanted);
    if (!picked && asked !== null && targetValue(asked) === String(wanted)) {
      if (targetValue(target) !== String(wanted)) setTarget(asked);
      return;
    }
    if (stillValid(target, list)) return;
    setTarget(pickTarget(saved, birth, wanted));
  }, [saved, birth, wanted, target, picked, needsLogin]);

  /** Лид уходит до оплаты. Отказ сети не теряет почту и не мешает платить. */
  const sendLead = async (mail: string): Promise<void> => {
    track("lead", { tariff: tariff.id, place: "pay" });
    try {
      await api.lead(mail, `pay:${tariff.id}`);
      setLead("sent");
      clearLead();
    } catch {
      saveLead({ email: mail, tariff: tariff.id, at: Date.now() });
      setLead("kept");
    }
  };

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

      await sendLead(mail);

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
          } catch (loginErr) {
            if (loginErr instanceof ApiError && loginErr.status === 401) {
              setStage({ kind: "login-needed" });
              setError(
                "На эту почту уже есть аккаунт, и этот пароль к нему не подошёл. Введите пароль " +
                  "аккаунта или восстановите его на /forgot — тариф начислится ему.",
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
      setStage({ kind: "paid", paymentId: res.payment_id, email: mail, matrix: res.matrix });
      // Кеш сегментов держит страницы, напечатанные до оплаты: без сброса «назад» возвращал
      // разбор с замками. Адрес с `paid` отделяет чек от формы.
      router.replace(`${here}?paid=${encodeURIComponent(res.payment_id)}`, { scroll: false });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const tail = " Платёж не прошёл — деньги не списаны.";
        if (err.status === 401) {
          setStage({ kind: "login-needed" });
          setError("Сессия истекла — введите пароль аккаунта ещё раз." + tail);
          return;
        }
        setError(
          err.status === 0
            ? "Сервер не ответил, платёж не прошёл — деньги не списаны. Попробуйте ещё раз."
            : err.message.replace(/[.!…]?$/, ".") + tail,
        );
      } else {
        setError("Что-то пошло не так. Попробуйте ещё раз.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (stage.kind === "paid" && receipt) {
    return (
      <div className="panel paybox">
        <h3>Доступ открыт</h3>
        <div className="cap">
          Платёж {stage.paymentId} · тариф «{tariff.name}»
        </div>
        <p className="dim">
          Это тестовый приём оплаты: настоящий провайдер подключается позже за тем же интерфейсом, номер
          платежа уже реальный. Разделы открыты в аккаунте{" "}
          <b data-testid="account-email">{stage.email}</b>, а не в этом браузере, — поэтому доступ
          работает и с телефона.
        </p>

        <p className="hint">
          Вход с другого устройства — <Link href="/login">/login</Link>: почта {stage.email} и пароль,
          который вы задали.
        </p>
        {signedInto ? (
          <p className="hint" data-testid="signed-into" style={{ textAlign: "left" }}>
            Аккаунт на {signedInto} уже существовал — мы вошли в него, а не создали новый. Поэтому в
            кабинете есть прежние матрицы и платежи.
          </p>
        ) : null}
        {stage.matrix ? (
          <p className="hint" style={{ textAlign: "left" }}>
            Этим платежом открыта: <b>{stage.matrix.title ?? birthLabel(stage.matrix.birth)}</b>.
          </p>
        ) : null}

        <Link
          className="btn wide"
          href={stage.matrix ? `/report?m=${stage.matrix.id}` : "/report"}
          style={{ marginTop: 14 }}
        >
          Открыть полный разбор
        </Link>

        {stage.matrix ? (
          <p className="small" data-testid="paid-matrix">
            {stage.matrix.title ?? birthLabel(stage.matrix.birth)} сохранена в кабинете — платные
            разделы печатает сервер, поэтому разбор открывается с любого устройства.
          </p>
        ) : null}

        {lead === "kept" ? (
          <p className="hint" data-testid="lead-status">
            Почту сервер не принял — она сохранена в этом браузере и уйдёт при следующем открытии формы.
          </p>
        ) : null}
      </div>
    );
  }

  const known = stage.kind === "login-needed";

  return (
    <form method="post" className="panel paybox" data-testid="pay-modal" onSubmit={submit}>
      <h3>Что покупаем</h3>
      <div className="cap">
        {tariffs.length > 1
          ? "Все 20 разделов разбора открывает любой из тарифов — разница в числе дат и сроке."
          : "Все 20 разделов разбора по одной дате рождения. Один платёж, доступ остаётся навсегда."}
      </div>

      {/* выбор не рисуем вовсе, пока продаём один тариф: скрытый стилями блок оставлял бы
          в разметке подписи вроде «Подписка» и «Одна дата» */}
      {tariffs.length > 1 ? (
      <div className="tchoice" role="radiogroup" aria-label="Тариф" data-testid="tariff-choice">
        {tariffs.map((t) => (
          <label className={t.id === tariff.id ? "topt on" : "topt"} key={t.id}>
            <input
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
            value={targetValue(target)}
            onChange={(e) => {
              setPicked(true);
              setTarget(fromValue(e.target.value));
            }}
          >
            {target === null ? <option value="none">Дата не выбрана</option> : null}
            {choices.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="hint" style={{ textAlign: "left" }}>
            {needsLogin ? (
              <span data-testid="pay-login-note">
                Эта дата сохранена в аккаунте — <Link href="/login">войдите</Link>, чтобы открыть
                именно её. Другую дату можно <Link href="/">посчитать на главной</Link>.
              </span>
            ) : target === null && opened ? (
              <span data-testid="pay-open-note">
                Разбор «{labelOf({ kind: "matrix", id: opened.id }, saved ?? [], birth)}» уже открыт
                — второй раз платить не нужно.{" "}
                <Link href={`/report?m=${opened.id}`}>Открыть разбор</Link>. Другую дату можно{" "}
                <Link href="/">посчитать на главной</Link>.
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
            id="payemail"
            data-testid="pay-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
                id="payemail"
                data-testid="pay-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mail.ru"
              />
            </div>
            <div>
              <label htmlFor="paypass">{known ? "Пароль этого аккаунта" : "Пароль для входа"}</label>
              <input
                id="paypass"
                data-testid="pay-password"
                name="password"
                type="password"
                autoComplete={known ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={known ? "ваш пароль" : `не короче ${MIN_PASSWORD} знаков`}
              />
            </div>
          </div>
          <p className="hint" style={{ textAlign: "left" }}>
            {known
              ? "На эту почту уже есть аккаунт — нужен его пароль. Забыли его? Восстановите на странице /forgot."
              : "С этой парой вход работает с любого устройства. На эту почту придёт письмо о покупке."}
          </p>
        </>
      )}

      <label className="consent">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
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
        {busy
          ? "Проводим платёж…"
          : `Оплатить ${money(tariff.price)} ₽${
              tariff.scope.includes("all") || chosenLabel === null ? "" : ` · ${chosenLabel}`
            }`}
      </button>

      {error ? <div className="err">{error}</div> : null}
      {signedInto ? (
        <p className="hint" data-testid="signed-into" style={{ textAlign: "left" }}>
          Аккаунт на {signedInto} уже был — мы вошли в него, новый не создавали. Тариф начислен ему,
          поэтому в кабинете видны прежние матрицы и платежи.
        </p>
      ) : null}
      {lead === "kept" ? (
        <p className="hint" data-testid="lead-status">
          Почту сервер не принял — сохранили её в этом браузере, отправим при следующем открытии формы.
        </p>
      ) : null}
      {lead === "sent" ? (
        <p className="hint" data-testid="lead-status">
          Почту приняли.
        </p>
      ) : null}

      <p className="hint">
        Платёжному провайдеру дата рождения не передаётся: в ссылку оплаты она не попадает. Выбранная
        дата сохраняется в ваш кабинет — по ней сервер печатает платные разделы.
      </p>
    </form>
  );
}
