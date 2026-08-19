"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, api, type MatrixListItem } from "@/lib/api";
import { track } from "@/lib/analytics";
import { clearLead, loadBirth, loadLead, saveLead } from "@/lib/storage";
import { byId, capLabel, money, periodLabel, type Tariff } from "@/lib/tariffs";

import { birthLabel } from "./MatrixResult";
import { refreshSession, useSession } from "./useSession";

type Stage =
  | { kind: "form" }
  // почта уже зарегистрирована, а введённый пароль не подошёл: нужен пароль владельца
  | { kind: "login-needed" }
  | { kind: "paid"; paymentId: string; email: string };

type LeadState = "none" | "sent" | "kept";

const MIN_PASSWORD = 3;

/** Что даёт тариф — выводим из scope, а не из списка в разметке: тариф правят в базе. */
function optionNote(t: Tariff): string {
  const parts = [t.scope.includes("all") ? "любое число дат" : "одна дата"];
  if (t.scope.includes("matrix")) parts.push("матрицы хранятся в кабинете");
  parts.push(t.period_days === null ? "остаётся навсегда" : `открыто ${periodLabel(t)}, потом закрывается`);
  return parts.join(" · ");
}

/**
 * Что откроет платёж. `later` — право уйдёт без даты и сядет на первую сохранённую: так было
 * всегда, и именно из-за этого деньги однажды открыли дату, которую никто не выбирал.
 */
type Target = "later" | "local" | number;

export default function PayForm({ tariffs, initial }: { tariffs: Tariff[]; initial: string }) {
  const [chosen, setChosen] = useState(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [lead, setLead] = useState<LeadState>("none");
  const [saveState, setSaveState] = useState<"no" | "busy" | "done" | "failed">("no");
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [limitNote, setLimitNote] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [birth, setBirth] = useState<{ birth: string; sex: "m" | "f" } | null>(null);
  const [saved, setSaved] = useState<MatrixListItem[] | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  // вошли в уже существующий аккаунт: об этом надо сказать, а не проводить молча
  const [signedInto, setSignedInto] = useState<string | null>(null);
  const wanted = Number(useSearchParams().get("m") ?? "") || null;
  const session = useSession();
  const tariff = byId(tariffs, chosen) ?? tariffs[0];
  const signedIn = session.status === "user" && session.email === email.trim().toLowerCase();

  // Цель pay_open уходит на открытии страницы: без неё воронка обрывается между
  // «нажал купить» и «оплатил», и тест трафика не показывает, где отваливаются.
  useEffect(() => {
    track("pay_open", { tariff: initial });
    setBirth(loadBirth());
  }, [initial]);

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
  // нечего: у него есть только дата из браузера.
  useEffect(() => {
    if (session.status !== "user") {
      setSaved([]);
      return;
    }
    api
      .matrices()
      .then((res) => setSaved(res.items))
      .catch(() => setSaved([]));
  }, [session.status]);

  const closed = (saved ?? []).filter((m) => m.access === "locked");
  const localSaved = birth ? (saved ?? []).find((m) => m.birth === birth.birth) : undefined;
  const canPickLocal = Boolean(birth) && !localSaved;

  // Что предложить по умолчанию: то, с чем пришли по ссылке из кабинета, иначе первая закрытая
  // дата, иначе дата из браузера. «Позже» остаётся осознанным выбором, а не молчаливым.
  useEffect(() => {
    if (target !== null || saved === null) return;
    if (wanted && (saved.some((m) => m.id === wanted) || saved.length === 0)) {
      setTarget(wanted);
      return;
    }
    const first = saved.find((m) => m.access === "locked");
    setTarget(first ? first.id : birth && !localSaved ? "local" : "later");
  }, [target, saved, wanted, birth, localSaved]);

  const targetLabel = (): string => {
    if (typeof target === "number") {
      const row = (saved ?? []).find((m) => m.id === target);
      return row ? row.title ?? birthLabel(row.birth) : "выбранная дата";
    }
    if (target === "local" && birth) return birthLabel(birth.birth);
    return "дата, которую сохраните после оплаты";
  };

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
    const typed = password.trim();
    if (!signedIn && typed.length < MIN_PASSWORD) {
      return setError(`Пароль для входа — не короче ${MIN_PASSWORD} знаков.`);
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
                  "аккаунта — тариф начислится ему.",
              );
              return;
            }
            throw loginErr;
          }
        }
      }

      // Какую дату открыть — выбрано на этом же экране. Без выбора право уходит без матрицы
      // и достаётся первой сохранённой: именно так деньги однажды открыли чужую по смыслу дату.
      const forMatrix = typeof target === "number" && !tariff.scope.includes("all")
        ? target
        : undefined;
      const res = await api.payMock(tariff.id, mail, forMatrix);
      track("purchase", { tariff: tariff.id });
      await refreshSession();
      setStage({ kind: "paid", paymentId: res.payment_id, email: mail });
      // Дата из браузера сохраняется в кабинет только если её и выбрали: платные разделы
      // печатает сервер по сохранённой матрице.
      if (target === "local") void saveMatrix();
      else if (forMatrix) setSavedId(forMatrix);
    } catch (err) {
      if (err instanceof ApiError) {
        const tail = " Платёж не прошёл — деньги не списаны.";
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

  const saveMatrix = async () => {
    if (!birth) return;
    setSaveState("busy");
    setSaveNote(null);
    setLimitNote(null);
    try {
      const saved = await api.saveMatrix(birth.birth, birth.sex);
      setSavedId(saved.id);
      setSaveState("done");
    } catch (err) {
      setSaveState("failed");
      if (err instanceof ApiError && err.status === 402) {
        // слоты кончились: каждая покупка добавляет один, поэтому предлагаем купить ещё раз
        setLimitNote(`${err.message} Уже сохранённые даты остаются открытыми.`);
        return;
      }
      setSaveNote(err instanceof ApiError ? err.message : "Не получилось сохранить матрицу.");
    }
  };

  if (stage.kind === "paid") {
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
        <p className="hint" style={{ textAlign: "left" }}>
          Этим платежом открыта: <b>{targetLabel()}</b>.
        </p>

        <Link
          className="btn wide"
          href={savedId ? `/report?m=${savedId}` : "/report"}
          style={{ marginTop: 14 }}
        >
          Открыть полный разбор
        </Link>

        {birth ? (
          <div style={{ marginTop: 14 }}>
            <p className="small">
              Матрица на {birthLabel(birth.birth)} посчитана в браузере, а платные разделы печатает
              сервер — поэтому после оплаты она сохранена в кабинет. Дальше разбор открывается с любого
              устройства.
            </p>
            <button
              className="btn ghost sm"
              data-testid="save-matrix"
              onClick={saveMatrix}
              disabled={saveState === "busy" || saveState === "done"}
            >
              {saveState === "done"
                ? "Сохранено в кабинете"
                : saveState === "busy"
                  ? "Сохраняем…"
                  : saveState === "failed"
                    ? "Сохранить ещё раз"
                    : "Сохранить матрицу в кабинет"}
            </button>
            {limitNote ? (
              <div className="err" data-testid="limit-message" role="status">
                {limitNote}
              </div>
            ) : null}
            {saveNote ? <div className="err">{saveNote}</div> : null}
          </div>
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
    <form className="panel paybox" data-testid="pay-modal" onSubmit={submit}>
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
            value={typeof target === "number" ? String(target) : (target ?? "later")}
            onChange={(e) => {
              const v = e.target.value;
              setTarget(v === "later" || v === "local" ? v : Number(v));
            }}
          >
            {closed.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title ?? birthLabel(m.birth)} — закрытая дата в кабинете
              </option>
            ))}
            {canPickLocal && birth ? (
              <option value="local">
                {birthLabel(birth.birth)} — дата из браузера, сохраним в кабинет
              </option>
            ) : null}
            <option value="later">Выберу позже — право дождётся новой даты</option>
          </select>
          <p className="hint" style={{ textAlign: "left" }}>
            {target === "later"
              ? "Право уйдёт без даты и сядет на первую дату, которую вы сохраните после оплаты."
              : `Откроется «${targetLabel()}». Дата рождения в платёж не передаётся — только её номер в кабинете.`}
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
              ? "На эту почту уже есть аккаунт — нужен его пароль. Восстановления пароля на сайте пока нет: если он утерян, оплатите с другой почты."
              : "С этой парой вход работает с любого устройства — писем мы не отправляем."}
          </p>
        </>
      )}

      <label className="consent">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          Согласен(на) на обработку персональных данных на условиях{" "}
          <Link href="/privacy">политики</Link>, принимаю <Link href="/oferta">оферту</Link> и{" "}
          <Link href="/refund">условия возврата</Link>.
        </span>
      </label>

      <button className="btn wide" data-testid="pay-submit" style={{ marginTop: 14 }} disabled={busy}>
        {busy ? "Проводим платёж…" : `Оплатить ${money(tariff.price)} ₽`}
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
        Дата рождения в платёж не передаётся: в ссылку оплаты она не попадает. После оплаты
        посчитанная в браузере матрица сохраняется в ваш кабинет — по ней сервер и печатает платные
        разделы.
      </p>
    </form>
  );
}
