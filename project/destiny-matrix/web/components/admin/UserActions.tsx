"use client";

import { useAdminLocale, useAdminMessage } from "./useAdminLocale";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import UserVisits from "./UserVisits";
import ActionsMenu from "@/components/admin/ActionsMenu";
import { ApiError, type AdminUser } from "@/lib/api";
import { type Sex } from "@/lib/matrix";
import { exampleDay } from "@/lib/today";

// Дата собирается тремя списками и переключателем пола — как в калькуляторе на сайте. Ввод датой
// одним полем выглядел чужеродно и на телефоне открывал системный календарь, в котором до 1970-х
// докручивать долго.
//
// Верхний год берётся из `lib/today`: собственный вызов часов в клиентском компоненте расходится
// с готовой серверной разметкой, сторож — `lib/today.test.ts` (он ищет вызов по всему файлу,
// включая комментарии).
const THIS_YEAR = exampleDay().year;
const YEARS = Array.from({ length: THIS_YEAR - 1900 + 1 }, (_, i) => THIS_YEAR - i);

interface PairPartner { day: number; month: number; year: number; name: string }
const NEW_PARTNER: PairPartner = { day: 1, month: 1, year: 1990, name: "" };

export default function UserActions({ user, onGranted, notices }: {
  user: AdminUser;
  onGranted?: () => void;
  /** куда выводить итог действия: в списке — строка над таблицей, иначе сообщение растягивало
   *  закреплённую колонку и закрывало «Доступ» у всех строк */
  notices?: HTMLElement | null;
}) {
  const { t, api, MONTHS_ACC, daysInMonth, toIso, day: dayLabel, birthLabel } = useAdminLocale();
  const [visits, setVisits] = useState(false);
  const [granting, setGranting] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [pair, setPair] = useState<Record<"a" | "b", PairPartner>>({ a: NEW_PARTNER, b: NEW_PARTNER });
  const [donePair, setDonePair] = useState<{ title: string; fresh: boolean } | null>(null);
  const [doneSubscription, setDoneSubscription] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useAdminMessage();
  // Повторная выдача ничего не добавляет: сервер говорит об этом полем `granted_now`.
  const [doneBirth, setDone] = useState<{ birth: string; fresh: boolean } | null>(null);
  const done = doneBirth
    ? t(doneBirth.fresh ? "Матрица {0} добавлена и открыта" : "Матрица {0} уже выдана", birthLabel(doneBirth.birth))
    : null;
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(1990);
  const [sex, setSex] = useState<Sex>("f");
  // Окно уезжает в body порталом: ячейка таблицы прилипшая, а прилипшая ячейка создаёт свой
  // контекст наложения — модалка внутри неё оказывалась под кнопками соседних строк.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Escape закрывает окно: без этого модалку приходилось закрывать мышью.
  useEffect(() => {
    if (!granting && !pairing) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGranting(false);
        setPairing(false);
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [granting, pairing]);

  const enter = async () => {
    const ok = window.confirm(
      t("Войти под {0}?\n", user.email) +
        t("Ваша админская сессия закроется — вернуться можно только своим входом.\n") +
        t("Вход будет записан в журнал безопасности."),
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await api.admin.impersonate(user.id);
      // Полная перезагрузка, а не router.push: кука сменилась, и всё, что уже отрисовано в
      // админке, принадлежит другому человеку.
      window.location.href = "/account";
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err : "Войти не удалось.");
    }
  };

  const grantSubscription = async () => {
    setBusy(true);
    setError(null);
    setDoneSubscription(null);
    try {
      const res = await api.admin.addSubscription(user.id);
      setDoneSubscription(res.until ? dayLabel(res.until) : "");
      onGranted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err : "Не удалось выдать подписку.");
    } finally {
      setBusy(false);
    }
  };

  const grantPair = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDonePair(null);
    try {
      const partner = (p: PairPartner) => ({ birth: toIso(p), name: p.name.trim() || undefined });
      const row = await api.admin.addReading(user.id, "pair", { a: partner(pair.a), b: partner(pair.b) });
      setDonePair({ title: row.title ?? "", fresh: row.granted_now !== false });
      setPairing(false);
      onGranted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err : "Не удалось добавить пару.");
    } finally {
      setBusy(false);
    }
  };

  const grant = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const row = await api.admin.addMatrix(user.id, toIso({ day, month, year }), sex);
      setDone({ birth: row.birth, fresh: row.granted_now !== false });
      setGranting(false);
      onGranted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err : "Не удалось добавить матрицу.");
    } finally {
      setBusy(false);
    }
  };

  const message = done || donePair !== null || doneSubscription !== null || (error && !granting) ? (
    <>
      {done ? <span className="ok" data-testid="grant-done">{done}</span> : null}
      {donePair !== null ? (
        <span className="ok" data-testid="grant-pair-done">
          {t(donePair.fresh ? "{0} — добавлена и открыта" : "{0} — уже выдана", donePair.title)}
        </span>
      ) : null}
      {doneSubscription !== null ? <span className="ok" data-testid="grant-subscription-done">{t("Подписка действует до {0}", doneSubscription)}</span> : null}
      {error && !granting ? <span className="err" role="status">{error}</span> : null}
    </>
  ) : null;

  return (
    <div className="actions">
      <ActionsMenu testId="user-actions" busy={busy} actions={[
        { label: t("Посмотреть визиты"), testId: "action-visits", onSelect: () => setVisits(true) },
        { label: t("Войти"), testId: "action-impersonate", onSelect: enter },
        { label: t("Добавить матрицу"), testId: "action-grant", onSelect: () => { setDone(null); setGranting(true); } },
        { label: t("Выдать пару"), testId: "action-grant-pair", onSelect: () => { setDonePair(null); setPairing(true); } },
        { label: t("Выдать подписку"), testId: "action-grant-subscription", onSelect: () => void grantSubscription() },
      ]} />

      {visits ? <UserVisits user={user} onClose={() => setVisits(false)} /> : null}

      {pairing && mounted ? createPortal(
        <div className="modal-back" onMouseDown={() => setPairing(false)}>
          <form className="modal" data-testid="grant-pair-dialog" onMouseDown={(event) => event.stopPropagation()}
            onSubmit={grantPair}>
            <h4>{t("Пара для ")}{user.email}</h4>
            <p className="cap">{t("Откроется сразу и без оплаты — в кабинете она будет помечена как выданная.")}</p>
            {(["a", "b"] as const).map((who) => {
              const p = pair[who];
              const set = (next: Partial<PairPartner>) => {
                const merged = { ...p, ...next };
                // число не больше дней выбранного месяца — как в окне матрицы
                merged.day = Math.min(merged.day, daysInMonth(merged.year, merged.month));
                setPair({ ...pair, [who]: merged });
              };
              return (
                <fieldset className="pairwho" key={who}>
                  <legend>{who === "a" ? t("Первый партнёр") : t("Второй партнёр")}</legend>
                  <div className="fields">
                    <div>
                      <label htmlFor={`grant-pair-${who}-d`}>{t("Число")}</label>
                      <select id={`grant-pair-${who}-d`} data-testid={`grant-pair-${who}-day`} value={p.day}
                        onChange={(e) => set({ day: Number(e.target.value) })}>
                        {Array.from({ length: daysInMonth(p.year, p.month) }, (_, i) => i + 1).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`grant-pair-${who}-m`}>{t("Месяц")}</label>
                      <select id={`grant-pair-${who}-m`} data-testid={`grant-pair-${who}-month`} value={p.month}
                        onChange={(e) => set({ month: Number(e.target.value) })}>
                        {MONTHS_ACC.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`grant-pair-${who}-y`}>{t("Год")}</label>
                      <select id={`grant-pair-${who}-y`} data-testid={`grant-pair-${who}-year`} value={p.year}
                        onChange={(e) => set({ year: Number(e.target.value) })}>
                        {YEARS.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <label htmlFor={`grant-pair-${who}n`} className="pairname">{t("Имя, необязательно")}</label>
                  <input id={`grant-pair-${who}n`} maxLength={60} value={p.name}
                    onChange={(e) => set({ name: e.target.value })} />
                </fieldset>
              );
            })}
            {error ? <p className="err" role="status">{error}</p> : null}
            <button type="submit" className="btn wide" disabled={busy} data-testid="grant-pair-submit" style={{ marginTop: 12 }}>
              {busy ? t("Добавляем…") : t("Выдать пару")}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setPairing(false)}>{t("Отмена")}</button>
          </form>
        </div>,
        document.body,
      ) : null}

      {granting && mounted ? createPortal(
        <div className="modal-back" onMouseDown={() => setGranting(false)}>
          <form
            className="modal"
            data-testid="grant-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={grant}
          >
            <h4>{t("Матрица для ")}{user.email}</h4>
            <p className="cap">{t("Откроется сразу и без оплаты — в кабинете она будет помечена как выданная.")}</p>
            <div className="fields">
              <div>
                <label htmlFor="grant-d">{t("Число")}</label>
                <select id="grant-d" data-testid="grant-day" value={day}
                        onChange={(e) => setDay(Number(e.target.value))}>
                  {/* дней ровно столько, сколько в выбранном месяце: 31 февраля выбрать нельзя,
                      да и список короче — в низком окне он открывался за край экрана */}
                  {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="grant-m">{t("Месяц")}</label>
                <select id="grant-m" data-testid="grant-month" value={month}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setMonth(next);
                          setDay((was) => Math.min(was, daysInMonth(year, next)));
                        }}>
                  {MONTHS_ACC.map((name, i) => (
                    <option key={name} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="grant-y">{t("Год")}</label>
                <select id="grant-y" data-testid="grant-year" value={year}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setYear(next);
                          setDay((was) => Math.min(was, daysInMonth(next, month)));
                        }}>
                  {YEARS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sexrow" role="group" aria-label={t("Пол")}>
              <button type="button" data-testid="grant-sex-f" data-sex="f"
                      aria-pressed={sex === "f"} className={sex === "f" ? "on" : ""}
                      onClick={() => setSex("f")}>
                {t("Женский")}</button>
              <button type="button" data-testid="grant-sex-m" data-sex="m"
                      aria-pressed={sex === "m"} className={sex === "m" ? "on" : ""}
                      onClick={() => setSex("m")}>
                {t("Мужской")}</button>
            </div>
            {error ? <p className="err" role="status">{error}</p> : null}
            <button type="submit" className="btn wide" disabled={busy} data-testid="grant-submit"
                    style={{ marginTop: 12 }}>
              {busy ? t("Добавляем…") : t("Добавить матрицу")}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setGranting(false)}>
              {t("Отмена")}</button>
          </form>
        </div>,
        document.body,
      ) : null}

      {notices && mounted ? (message ? createPortal(<p className="small notice">{user.email}: {message}</p>, notices) : null) : message}
    </div>
  );
}
