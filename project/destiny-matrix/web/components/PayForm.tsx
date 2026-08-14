"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { clearLead, loadBirth, loadLead, saveLead } from "@/lib/storage";
import { money, periodLabel, type Tariff } from "@/lib/tariffs";

import { birthLabel } from "./MatrixResult";
import { refreshSession, useSession } from "./useSession";

type Stage =
  | { kind: "form" }
  // почта уже зарегистрирована: тариф начисляется владельцу, доступ — только его паролем
  | { kind: "login-needed" }
  | { kind: "paid"; paymentId: string; password: string | null; email: string };

type LeadState = "none" | "sent" | "kept";

const MIN_PASSWORD = 8;

const LINK_BTN: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  color: "var(--gold)",
  textDecoration: "underline",
  cursor: "pointer",
  width: "auto",
};

/** Пароль без похожих знаков (0/O, 1/l): его придётся перепечатывать с экрана вручную. */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return [...bytes].map((n) => alphabet[n % alphabet.length]).join("");
}

export default function PayForm({ tariff }: { tariff: Tariff }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ownPassword, setOwnPassword] = useState(false);
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
  // пароль, который мы сгенерировали и на который уже создан аккаунт: показать его обязаны,
  // даже если платёж потом сорвался, иначе человек останется с аккаунтом без пароля
  const [issued, setIssued] = useState<string | null>(null);
  const session = useSession();

  // Цель pay_open уходит на открытии страницы: без неё воронка обрывается между
  // «нажал купить» и «оплатил», и тест трафика не показывает, где отваливаются.
  useEffect(() => {
    track("pay_open", { tariff: tariff.id });
    setBirth(loadBirth());
  }, [tariff.id]);

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
    if (typed && typed.length < MIN_PASSWORD) {
      return setError(`Пароль — не короче ${MIN_PASSWORD} знаков.`);
    }
    if (stage.kind === "login-needed" && !typed) {
      return setError("Введите пароль от аккаунта на эту почту.");
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

      // Доступ обязан работать с любого устройства, поэтому аккаунт с известным паролем
      // создаётся до платежа: своим паролем, если его ввели, сгенерированным — если нет.
      const secret = typed || issued || generatePassword();
      let showPassword: string | null = typed ? null : secret;

      if (live.status !== "user") {
        try {
          await api.register(mail, secret);
          if (!typed) setIssued(secret);
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 400) throw err;
          // почта занята: чужому аккаунту наш пароль не подойдёт — нужен пароль владельца.
          // Свой прошлый сгенерированный (issued) подойдёт: аккаунт создан этой же формой.
          if (!typed && !issued) {
            setStage({ kind: "login-needed" });
            setOwnPassword(true);
            setError(
              "На эту почту уже есть аккаунт. Введите его пароль — тариф начислится вам, " +
                "и разделы откроются в аккаунте.",
            );
            return;
          }
          await api.login(mail, secret);
        }
      } else {
        showPassword = null;
      }

      const res = await api.payMock(tariff.id, mail);
      track("purchase", { tariff: tariff.id });
      await refreshSession();
      setStage({ kind: "paid", paymentId: res.payment_id, password: showPassword, email: mail });
      // Матрица уходит в кабинет сразу после оплаты: платные разделы печатает сервер по
      // сохранённой матрице, поэтому без неё покупателю нечего открывать. Об этом сказано в
      // форме до кнопки оплаты.
      void saveMatrix();
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
        setLimitNote(
          `${err.message} По этому тарифу лимит матриц исчерпан — разбор открывается по уже ` +
            "сохранённой матрице.",
        );
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

        {stage.password ? (
          <PasswordOnce password={stage.password} email={stage.email} />
        ) : (
          <p className="hint">
            Вход с другого устройства — <Link href="/login">/login</Link>: почта {stage.email} и ваш
            пароль.
          </p>
        )}

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
      <h3>Оплата тарифа «{tariff.name}»</h3>
      <div className="cap">
        {money(tariff.price)} ₽ · {periodLabel(tariff)} · матриц: {(tariff.scope.includes('all') ? null : 1)}
      </div>

      <div className="payrow">
        <span>{tariff.name}</span>
        <span className="p">{money(tariff.price)} ₽</span>
      </div>
      <ul className="pmlist plus" style={{ marginTop: 12 }}>
        {[].map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

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

      {session.status === "user" && session.email === email.trim().toLowerCase() ? (
        <p className="hint">Вы вошли как {session.email}: тариф начислится этому аккаунту.</p>
      ) : ownPassword || known ? (
        <>
          <label htmlFor="paypass" style={{ marginTop: 12 }}>
            {known ? "Пароль от аккаунта на эту почту" : "Пароль для входа"}
          </label>
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
          <p className="hint">
            {known
              ? "Восстановления пароля на сайте пока нет: если он утерян, оплатите с другой почты."
              : "С этим паролем вход работает с любого устройства."}
          </p>
        </>
      ) : (
        <p className="hint">
          Пароль для входа сгенерируем и покажем сразу после оплаты — писем мы не отправляем.{" "}
          <button type="button" style={LINK_BTN} onClick={() => setOwnPassword(true)}>
            Задать свой пароль
          </button>
        </p>
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
      {issued ? (
        <>
          <p className="small" style={{ marginTop: 10 }}>
            Аккаунт на {email.trim().toLowerCase()} уже создан этой формой. Доступ откроется, когда
            платёж пройдёт, а пароль сохраните сейчас:
          </p>
          <PasswordOnce password={issued} email={email.trim().toLowerCase()} />
        </>
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

function PasswordOnce({ password, email }: { password: string; email: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        border: "1px solid var(--gold)",
        borderRadius: 12,
        background: "var(--paper)",
      }}
    >
      <div style={{ fontSize: 13, color: "var(--dim)" }}>Пароль для входа — покажем только раз:</div>
      <div
        data-testid="issued-password"
        style={{ font: "700 19px var(--sans)", letterSpacing: "0.04em", margin: "6px 0" }}
      >
        {password}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--dim)" }}>
        Сохраните его сейчас: письма мы не отправляем и повторно этот пароль не покажем. Вход —{" "}
        <Link href="/login">/login</Link>, почта {email}.
      </div>
    </div>
  );
}
