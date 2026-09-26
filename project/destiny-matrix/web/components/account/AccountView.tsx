"use client";

import { useSession } from "@/components/account/useSession";
import { forLocale as localizedMatrixResult } from "@/components/matrix/MatrixResult";
import SaveMatrixButton from "@/components/matrix/SaveMatrixButton";
import { useTariffs } from "@/components/pay/TariffsProvider";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ALL_FREE } from "@/lib/access";
import { ApiError, forLocale as localizedApi, type MatrixListItem, type PaymentItem } from "@/lib/api";
import { D, forLocale as localizedI18n } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { useMessage, type Message } from "@/lib/i18n/useMessage";
import { forLocale as localizedMatrix } from "@/lib/matrix";
import { forLocale as localizedTariffs } from "@/lib/tariffs";
import { useBirth } from "@/lib/useBirth";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export const forLocale = localized((L: Locale) => {
  const { dateTimeLabel, dayLabel } = localizedI18n(L);
  const { api } = localizedApi(L);
  const { calculate } = localizedMatrix(L);
  const { money, priceLabel } = localizedTariffs(L);
  const { birthLabel } = localizedMatrixResult(L);

  const dateCount = (n: number) => D.account.datesCount[L](n);

  function safeCenter(birth: string, sex: "m" | "f"): string {
    try {
      return String(calculate(birth, sex).center);
    } catch {
      return "—";
    }
  }
  return { dateTimeLabel, dayLabel, api, calculate, money, priceLabel, birthLabel, dateCount, safeCenter };
});

/**
 * Подпись матрицы прямо в строке списка: имя, а рядом карандаш. Имя нужно, чтобы список из
 * нескольких дат читался — «Матрица 31 марта 1993» не говорит, чья она.
 */
function MatrixName({ locale: requestedLocale, ...localeProps }: ({
  item: MatrixListItem;
  onSave: (title: string) => Promise<Message | null>;
}) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const {
    item,
    onSave,
  } = localeProps;
  const { birthLabel } = forLocale(L);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.title ?? "");
  const [busy, setBusy] = useState(false);
  // отказ печатался внизу панели — на телефоне за краем экрана, а поле при этом закрывалось
  // и выбрасывало набранное имя
  const [failed, setFailed] = useMessage(L);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(null);
    try {
      const problem = await onSave(value.trim());
      if (problem) setFailed(problem);
      else setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <span className="matname">
        <span>{item.title ?? birthLabel(item.birth)}</span>
        <button
          type="button"
          className="iconbtn"
          data-testid="rename-matrix"
          title={D.account.signMatrix[L]}
          aria-label={D.account.signMatrix[L]}
          onClick={() => {
            setValue(item.title ?? "");
            setFailed(null);
            setEditing(true);
          }}
        >
          ✎
        </button>
        <AccessBadge locale={L} item={item} />
      </span>
    );
  }

  return (
    <span className="matname">
      <input
        autoFocus
        data-testid="rename-input"
        maxLength={200}
        value={value}
        placeholder={birthLabel(item.birth)}
        onChange={(e) => {
          setFailed(null);
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        type="button"
        className="btn sm"
        data-testid="rename-save"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? "…" : D.account.save[L]}
      </button>
      <button type="button" className="iconbtn" title={D.account.cancel[L]} onClick={() => setEditing(false)}>
        ✕
      </button>
      {failed ? (
        <span className="err inline" data-testid="rename-error">
          {failed}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Метка доступа у строки матрицы. Купленная выделена особо: она остаётся у человека, даже когда
 * подписка кончится, — это разные вещи, и в списке они не должны выглядеть одинаково. Знак
 * пожизненного владения — ∞ в золотом круге: понятен без подписи и не спорит с текстом бейджа.
 * Выданная админом открыта так же, но золота не получает: подарок — не покупка.
 */
function AccessBadge({ locale: requestedLocale, ...localeProps }: ({ item: MatrixListItem }) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { item } = localeProps;
  const { dayLabel } = forLocale(L);

  if (item.access === "forever") {
    return (
      <span className="badge own" data-testid="access-badge">
        <i className="lifetime" aria-hidden="true">
          ∞
        </i>
        {D.account.badgeBought[L]}
      </span>
    );
  }
  if (item.access === "open") {
    // витрина без оплаты: открыта всем, покупкой не является
    return (
      <span className="badge sub" data-testid="access-badge">
        {D.account.badgeOpen[L]}
      </span>
    );
  }
  if (item.access === "granted") {
    // Выдана без оплаты. Бейдж обычный: знак владения (∞ в золоте) принадлежит купленным.
    return (
      <span className="badge sub" data-testid="access-badge">
        {D.account.badgeOpen[L]}
      </span>
    );
  }
  if (item.access === "subscription") {
    const until = item.access_until ? new Date(item.access_until) : null;
    return (
      <span className="badge sub" data-testid="access-badge">
        {D.account.badgeSubscription[L](until ? dayLabel(item.access_until) : "")}
      </span>
    );
  }
  return (
    <span className="badge off" data-testid="access-badge">
      {D.account.badgeClosed[L]}
    </span>
  );
}

export default function AccountView({ locale: requestedLocale, ...localeProps }: ({}) & { locale?: Locale } = {}) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { dayLabel, api, priceLabel, birthLabel, dateCount, safeCenter } = forLocale(L);

  const tariffs = useTariffs();
  const session = useSession();
  const [items, setItems] = useState<MatrixListItem[] | null>(null);
  const [error, setError] = useMessage(L);
  const [note, setNote] = useMessage(L);
  // дата из браузера — общим хуком: своё чтение при монтировании не замечало смену даты
  const local = useBirth();

  const reload = useCallback(async () => {
    try {
      const res = await api.matrices();
      setItems(res.items);
      setError(null);
    } catch (err) {
      setError((locale) => err instanceof ApiError ? err.messageFor(locale) : D.account.unavailable[locale]);
    }
  }, [L]);

  useEffect(() => {
    if (session.status !== "user") return;
    void reload();
  }, [session.status, session.email, reload]);

  // уведомление живёт несколько секунд: постоянная плашка «имя изменено» мешала бы читать список
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(timer);
  }, [note]);

  /** Возвращает текст отказа: строка сама решает, что показать рядом с полем. */
  const rename = async (id: number, title: string): Promise<Message | null> => {
    try {
      const row = await api.renameMatrix(id, title);
      setItems((prev) => prev?.map((x) => (x.id === id ? { ...x, title: row.title } : x)) ?? prev);
      setNote((locale) => D.account.renamed[locale]);
      setError(null);
      return null;
    } catch (err) {
      return (locale) => err instanceof ApiError ? err.messageFor(locale) : D.account.renameFailed[locale];
    }
  };

  if (session.status === "loading") return <p className="skeleton">{D.account.checkingAccess[L]}</p>;

  if (session.status !== "user") {
    return (
      <div className="panel narrow">
        <h3>{D.account.needSignIn[L]}</h3>
        <p className="dim">
          {D.account.needSignInText[L]}
        </p>
        {session.status === "offline" ? (
          <div className="err" role="alert" aria-live="assertive">{session.error ?? D.account.serverSilent[L]} {D.account.refreshPage[L]}</div>
        ) : null}
        <Link className="btn wide" href="/login">
          {D.auth.signIn[L]}
        </Link>
        <p className="hint">
          {D.auth.noAccount[L]} <Link href="/register">{D.auth.register[L]}</Link>{" "}
          {D.account.orJustCalculate[L]}{" "}
          <Link href="/#calc">{D.account.justCalculate[L]}</Link>
        </p>
      </div>
    );
  }

  const list = items ?? [];
  // «Мой разбор» ведёт на купленную дату, а не на первую в списке: список отсортирован по
  // сохранению, и после нового расчёта пункт уводил на закрытую матрицу с предложением купить.
  const paidFirst = list.find((row) => row.access !== "locked") ?? null;
  // Доступ описывают права, а не поле тарифа: разовое привязано к своей дате, месячное
  // открывает любые. Имя и цена — из справочника в базе, чтобы не расходились с витриной.
  const unlimitedPlan = tariffs.find((t) => t.scope.includes("all"));
  const singlePlan = tariffs.find((t) => !t.scope.includes("all"));
  const plan = session.unlimited ? unlimitedPlan : session.paid ? singlePlan : undefined;
  const until = session.until ? new Date(session.until) : null;

  return (
    <>
      <div className="panel">
        <h3>{D.account.yourAccess[L]}</h3>
        <div className="cap" data-testid="account-email">
          {session.email}
        </div>
        <dl className="kv">
          <dt>{D.account.accessWord[L]}</dt>
          <dd data-testid="account-access">
            {/* покупки и подписка выводятся отдельными строками: они живут одновременно, и
                одна не отменяет другую — раньше подписка затирала купленные даты */}
            {session.owned > 0 ? (
              <div>
                <i className="lifetime" aria-hidden="true">
                  ∞
                </i>{" "}
                {D.account.boughtForever[L](dateCount(session.owned))}
                {singlePlan ? ` · ${D.common.quoted[L](singlePlan.name)}` : ""}
              </div>
            ) : null}
            {/* тариф «на все даты» снят с витрины, и по его отсутствию в справочнике блок
                оказывался пустым: у оплатившего доступ строка «Доступ» была пустой, а рядом
                висело предложение купить */}
            {!ALL_FREE && session.unlimited ? (
              <div>
                {unlimitedPlan
                  ? `${unlimitedPlan.name} — ${priceLabel(unlimitedPlan)}`
                  : D.account.allDatesAccess[L]}
                {session.until ? D.account.until[L](dayLabel(session.until)) : ""}
              </div>
            ) : null}
            {ALL_FREE ? (
              <div>{D.account.allFreeAccess[L]}</div>
            ) : null}
            {!ALL_FREE && session.owned === 0 && !session.unlimited ? (
              <div>
                {plan ? `${plan.name} — ${priceLabel(plan)}` : D.account.notPaid[L]}
                {plan ? "" : D.account.twoFreeSections[L]}
                {session.until ? D.account.until[L](dayLabel(session.until)) : ""}
              </div>
            ) : null}
          </dd>
          <dt>{D.account.matricesWord[L]}</dt>
          <dd>
            {/* после возврата слот пропадает, а сохранённое остаётся: строка «2 из 1» выглядела
                поломкой и не объясняла, почему нельзя добавить дату */}
            {session.limit === null
              ? D.account.storageUnlimited[L](session.used)
              : session.used > session.limit
                ? D.account.storageOver[L](session.used, session.limit)
                : D.account.storageOf[L](session.used, session.limit)}
          </dd>
        </dl>
        <div className="taglist" style={{ marginTop: 12 }}>
          {/* На чистом устройстве /report не знает дату из sessionStorage. Сохранённую матрицу
              открываем по её серверному id, поэтому ссылка работает на любом устройстве. */}
          {items === null ? (
            <span className="dim" aria-disabled="true">{D.account.reportLoading[L]}</span>
          ) : paidFirst ? (
            <Link data-testid="account-report" href={`/matrices/${paidFirst.id}`}>{D.nav.myReading[L]}</Link>
          ) : list.length ? (
            <Link data-testid="account-report" href={`/matrices/${list[0].id}`}>{D.nav.myReading[L]}</Link>
          ) : (
            <Link data-testid="account-report" href="/report">{D.nav.myReading[L]}</Link>
          )}
          <Link href="/#calc">{D.nav.newCalculation[L]}</Link>
          {/* покупку предлагаем тем, у кого прав нет. Смотрим на права, а не на найденный
              тариф: «на все даты» снят с витрины, и оплатившему предлагали купить снова */}
          {ALL_FREE || session.paid || session.unlimited ? null : (
            <Link href="/pay">{D.account.buyFullReading[L]}</Link>
          )}
          {session.admin ? <Link href="/admin">{D.account.admin[L]}</Link> : null}
        </div>
        <p className="hint" style={{ textAlign: "left" }}>
          {D.account.accessLivesInAccount[L]}
        </p>
      </div>

      <div className="panel section-gap">
        <h3>{D.account.savedMatrices[L]}</h3>
        <div className="cap">
          {ALL_FREE ? D.account.savedMatricesHintFree[L] : D.account.savedMatricesHint[L]}
        </div>
        {note ? (
          <div className="okmsg" role="status" data-testid="account-note">
            {note}
          </div>
        ) : null}
        {/* Список рисуется всегда, даже пустой: по нему видно, что кабинет открыт, а не сломан. */}
        <ul
          className="matlist"
          data-testid="matrices-list"
          style={{ listStyle: "none", padding: 0, margin: 0 }}
        >
          {/* отказ сети раньше оставлял вечное «Загружаем список…» рядом с сообщением об
              ошибке и предложением сохранить дату — три состояния одновременно */}
          {items === null && error ? (
            <li className="dim">{D.account.listFailed[L](error)}</li>
          ) : items === null ? (
            <li className="skeleton">{D.account.listLoading[L]}</li>
          ) : list.length === 0 ? (
            <li className="dim">{D.account.listEmpty[L]}</li>
          ) : (
            list.map((it) => (
              <li
                className={it.access === "locked" ? "matrow locked" : `matrow ${it.access}`}
                key={it.id}
                data-testid="matrix-card"
                data-birth={it.birth}
                data-access={it.access}
              >
                <div>
                  <MatrixName locale={L} item={it} onSave={(title) => rename(it.id, title)} />
                  <div className="small">
                    {birthLabel(it.birth)} ·{" "}
                    {it.sex === "f" ? D.calc.femaleChart[L] : D.calc.maleChart[L]}{" "}
                    {D.account.chartWord[L]} · {D.account.centreArcanum[L]}{" "}
                    {safeCenter(it.birth, it.sex)}
                  </div>
                </div>
                {it.access === "locked" ? (
                  <span className="matact">
                    <Link className="btn ghost sm" href={`/matrices/${it.id}`}>
                      {D.account.twoSections[L]}
                    </Link>
                    {/* id даты уходит в ссылку: на экране оплаты она уже выбрана, и платёж
                        открывает именно её, а не «первую сохранённую» */}
                    <Link className="btn sm" href={`/pay?m=${it.id}`}>
                      {singlePlan ? D.account.openFor[L](priceLabel(singlePlan)) : D.account.open[L]}
                    </Link>
                  </span>
                ) : (
                  <Link className="btn ghost sm" href={`/matrices/${it.id}`}>
                    {D.account.open[L]}
                  </Link>
                )}
              </li>
            ))
          )}
        </ul>

        {/* дата из браузера предлагается к сохранению только если её ещё нет в списке:
            иначе предложение висело под карточкой той же даты, а кнопка ничего не делала */}
        {/* пока список не пришёл, мы не знаем, сохранена дата или нет: предлагать сохранение
            поверх ошибки загрузки — третье состояние на том же экране */}
        {items !== null && local && !list.some((it) => it.birth === local.birth && it.sex === local.sex) ? (
          <div style={{ marginTop: 14 }}>
            <p className="small">
              {D.account.localCalc[L](birthLabel(local.birth))}
            </p>
            <SaveMatrixButton locale={L}
              birth={local.birth}
              sex={local.sex}
              label={D.account.saveCurrent[L]}
              openReport={false}
              onSaved={async () => {
                await reload();
                await session.refresh();
              }}
            />
          </div>
        ) : (
          <p className="small" style={{ marginTop: 14 }}>
            <Link href="/#calc">{D.account.calculateToSave[L]}</Link>{D.account.calculateToSaveTail[L]}
          </p>
        )}

        {error ? <div className="err" role="alert" aria-live="assertive">{error}</div> : null}
      </div>

      {/* платить негде: истории платежей на витрине без кассы не бывает */}
      {ALL_FREE ? null : <PaymentsPanel locale={L} />}
    </>
  );
}

/**
 * История платежей. Отдельным запросом и отдельной панелью: список матриц нужен на каждом
 * открытии кабинета, а платежи — справка, и грузить их вместе смысла нет.
 */
function PaymentsPanel({ locale: requestedLocale, ...localeProps }: ({}) & { locale?: Locale } = {}) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { dateTimeLabel, api, money } = forLocale(L);

  const [rows, setRows] = useState<PaymentItem[] | null>(null);
  const [failed, setFailed] = useMessage(L);

  useEffect(() => {
    api
      .payments()
      .then((res) => { setRows(res.items); setFailed(null); })
      .catch((err) => setFailed((locale) => err instanceof ApiError ? err.messageFor(locale) : D.account.paymentsUnavailable[locale]));
  }, [L]);

  return (
    <div className="panel section-gap" data-testid="payments-panel">
      <h3>{D.account.myPayments[L]}</h3>
      <div className="cap">{D.account.paymentsHint[L]}</div>
      {failed ? <div className="err" role="alert" aria-live="assertive">{failed}</div> : null}
      {rows === null && !failed ? <p className="skeleton">{D.account.paymentsLoading[L]}</p> : null}
      {rows && rows.length === 0 ? <p className="dim">{D.account.paymentsEmpty[L]}</p> : null}
      {rows && rows.length ? (
        <ul className="paylist">
          {rows.map((p) => {
            const when = new Date(p.paid_at ?? p.created_at);
            return (
              <li key={p.id} data-testid="payment-row">
                <span className="pw">
                  <b>{p.tariff.display_name ?? p.tariff.name ?? D.account.planWord[L]}</b>
                  <span className="small">
                    {dateTimeLabel(p.created_at)} · {p.external_id}
                  </span>
                </span>
                <span className="pa">
                  {D.pay.priceFormat[L](money(p.amount))}
                  <span className="small">
                    {p.state === "refunded"
                      ? D.account.stateRefunded[L]
                      : p.state === "paid"
                        ? D.account.statePaid[L]
                        : p.state === "abandoned"
                          ? D.account.stateAbandoned[L]
                          : p.state === "failed"
                            ? D.account.stateFailed[L]
                            : D.account.stateUnpaid[L]}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
