"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiError, api, type MatrixListItem, type PaymentItem } from "@/lib/api";
import { calculate } from "@/lib/matrix";
import { loadBirth } from "@/lib/storage";
import { money } from "@/lib/tariffs";

import { birthLabel } from "./MatrixResult";
import SaveMatrixButton from "./SaveMatrixButton";
import { useTariffs } from "./TariffsProvider";
import { useSession } from "./useSession";

function dateCount(n: number): string {
  const tail = n % 100 >= 11 && n % 100 <= 14 ? 5 : n % 10;
  return `${n} ${tail === 1 ? "дата" : tail >= 2 && tail <= 4 ? "даты" : "дат"}`;
}

/**
 * Подпись матрицы прямо в строке списка: имя, а рядом карандаш. Имя нужно, чтобы список из
 * нескольких дат читался — «Матрица 31 марта 1993» не говорит, чья она.
 */
function MatrixName({
  item,
  onSave,
}: {
  item: MatrixListItem;
  onSave: (title: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.title ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(value.trim());
      setEditing(false);
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
          title="Подписать матрицу"
          aria-label="Подписать матрицу"
          onClick={() => {
            setValue(item.title ?? "");
            setEditing(true);
          }}
        >
          ✎
        </button>
        <AccessBadge item={item} />
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
        onChange={(e) => setValue(e.target.value)}
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
        {busy ? "…" : "Сохранить"}
      </button>
      <button type="button" className="iconbtn" title="Отменить" onClick={() => setEditing(false)}>
        ✕
      </button>
    </span>
  );
}

/**
 * Метка доступа у строки матрицы. Купленная выделена особо: она остаётся у человека, даже когда
 * подписка кончится, — это разные вещи, и в списке они не должны выглядеть одинаково. Знак
 * пожизненного владения — ∞ в золотом круге: понятен без подписи и не спорит с текстом бейджа.
 */
function AccessBadge({ item }: { item: MatrixListItem }) {
  if (item.access === "forever") {
    return (
      <span className="badge own" data-testid="access-badge">
        <i className="lifetime" aria-hidden="true">
          ∞
        </i>
        Куплена
      </span>
    );
  }
  if (item.access === "subscription") {
    const until = item.access_until ? new Date(item.access_until) : null;
    return (
      <span className="badge sub" data-testid="access-badge">
        По подписке{until ? ` · до ${until.toLocaleDateString("ru-RU")}` : ""}
      </span>
    );
  }
  return (
    <span className="badge off" data-testid="access-badge">
      Закрыта
    </span>
  );
}

export default function AccountView() {
  const tariffs = useTariffs();
  const session = useSession();
  const [items, setItems] = useState<MatrixListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [local, setLocal] = useState<{ birth: string; sex: "m" | "f" } | null>(null);

  useEffect(() => {
    setLocal(loadBirth());
  }, []);

  const reload = useCallback(async () => {
    try {
      const res = await api.matrices();
      setItems(res.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Кабинет недоступен.");
    }
  }, []);

  useEffect(() => {
    if (session.status !== "user") return;
    void reload();
  }, [session.status, reload]);

  // уведомление живёт несколько секунд: постоянная плашка «имя изменено» мешала бы читать список
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(timer);
  }, [note]);

  const rename = async (id: number, title: string) => {
    try {
      const row = await api.renameMatrix(id, title);
      setItems((prev) => prev?.map((x) => (x.id === id ? { ...x, title: row.title } : x)) ?? prev);
      setNote("Имя изменено");
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось переименовать матрицу.");
    }
  };

  if (session.status === "loading") return <p className="skeleton">Проверяем доступ…</p>;

  if (session.status !== "user") {
    return (
      <div className="panel narrow">
        <h3>Нужен вход</h3>
        <p className="dim">
          Кабинет хранит сохранённые матрицы и доступ к платным разделам. Расчёт без регистрации остаётся
          доступным — он идёт в браузере.
        </p>
        {session.status === "offline" ? (
          <div className="err">{session.error ?? "Сервер не ответил."} Обновите страницу.</div>
        ) : null}
        <Link className="btn wide" href="/login">
          Войти
        </Link>
        <p className="hint">
          Нет аккаунта? <Link href="/register">Зарегистрироваться</Link> · или{" "}
          <Link href="/#calc">просто рассчитать</Link>
        </p>
      </div>
    );
  }

  const list = items ?? [];
  // Доступ описывают права, а не поле тарифа: разовое привязано к своей дате, месячное
  // открывает любые. Имя и цена — из справочника в базе, чтобы не расходились с витриной.
  const unlimitedPlan = tariffs.find((t) => t.scope.includes("all"));
  const singlePlan = tariffs.find((t) => !t.scope.includes("all"));
  const plan = session.unlimited ? unlimitedPlan : session.paid ? singlePlan : undefined;
  const until = session.until ? new Date(session.until) : null;

  return (
    <>
      <div className="panel">
        <h3>Ваш доступ</h3>
        <div className="cap" data-testid="account-email">
          {session.email}
        </div>
        <dl className="kv">
          <dt>Доступ</dt>
          <dd data-testid="account-access">
            {/* покупки и подписка выводятся отдельными строками: они живут одновременно, и
                одна не отменяет другую — раньше подписка затирала купленные даты */}
            {session.owned > 0 ? (
              <div>
                <i className="lifetime" aria-hidden="true">
                  ∞
                </i>{" "}
                Куплено {dateCount(session.owned)} навсегда
                {singlePlan ? ` · «${singlePlan.name}»` : ""}
              </div>
            ) : null}
            {session.unlimited && unlimitedPlan ? (
              <div>
                {unlimitedPlan.name} — {money(unlimitedPlan.price)} ₽
                {until ? ` · до ${until.toLocaleDateString("ru-RU")}` : ""}
              </div>
            ) : null}
            {session.owned === 0 && !session.unlimited ? (
              <div>
                {plan ? `${plan.name} — ${money(plan.price)} ₽` : "не оплачен"}
                {plan ? "" : " · два раздела открыты бесплатно"}
                {until ? ` · до ${until.toLocaleDateString("ru-RU")}` : ""}
              </div>
            ) : null}
          </dd>
          <dt>Матрицы</dt>
          <dd>
            {session.used}
            {session.limit === null
              ? " · хранение без ограничений"
              : ` из ${session.limit} · слот даёт каждая покупка разбора`}
          </dd>
        </dl>
        <div className="taglist" style={{ marginTop: 12 }}>
          <Link href="/report">Мой разбор</Link>
          <Link href="/#calc">Новый расчёт</Link>
          {/* покупку предлагаем тем, у кого прав нет: тариф выбирается на странице оплаты */}
          {plan ? null : <Link href="/pay">Купить полный разбор</Link>}
          {session.admin ? <Link href="/admin">Админка</Link> : null}
        </div>
        <p className="hint" style={{ textAlign: "left" }}>
          Доступ к разделам приходит с сервера при каждом открытии страницы: в браузере он не хранится,
          поэтому работает с любого устройства и не открывается правкой localStorage.
        </p>
      </div>

      <div className="panel section-gap">
        <h3>Сохранённые матрицы</h3>
        <div className="cap">Дата рождения уходит на сервер только здесь — по вашему действию</div>
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
          {items === null ? (
            <li className="skeleton">Загружаем список…</li>
          ) : list.length === 0 ? (
            <li className="dim">Пока ничего не сохранено.</li>
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
                  <MatrixName item={it} onSave={(title) => rename(it.id, title)} />
                  <div className="small">
                    {birthLabel(it.birth)} · {it.sex === "f" ? "женская" : "мужская"} карта · аркан центра{" "}
                    {safeCenter(it.birth, it.sex)}
                  </div>
                </div>
                {it.access === "locked" ? (
                  <span className="matact">
                    <Link className="btn ghost sm" href={`/matrices/${it.id}`}>
                      Два раздела
                    </Link>
                    {/* id даты уходит в ссылку: на экране оплаты она уже выбрана, и платёж
                        открывает именно её, а не «первую сохранённую» */}
                    <Link className="btn sm" href={`/pay?m=${it.id}`}>
                      Открыть{singlePlan ? ` — ${money(singlePlan.price)} ₽` : ""}
                    </Link>
                  </span>
                ) : (
                  <Link className="btn ghost sm" href={`/matrices/${it.id}`}>
                    Открыть
                  </Link>
                )}
              </li>
            ))
          )}
        </ul>

        {local ? (
          <div style={{ marginTop: 14 }}>
            <p className="small">
              В браузере открыт расчёт на {birthLabel(local.birth)} — можно сохранить его в кабинет.
            </p>
            <SaveMatrixButton
              birth={local.birth}
              sex={local.sex}
              label="Сохранить текущую матрицу"
              openReport={false}
              onSaved={async () => {
                await reload();
                await session.refresh();
              }}
            />
          </div>
        ) : (
          <p className="small" style={{ marginTop: 14 }}>
            <Link href="/#calc">Рассчитайте матрицу</Link>, чтобы сохранить её здесь.
          </p>
        )}

        {error ? <div className="err">{error}</div> : null}
      </div>

      <PaymentsPanel />
    </>
  );
}

/**
 * История платежей. Отдельным запросом и отдельной панелью: список матриц нужен на каждом
 * открытии кабинета, а платежи — справка, и грузить их вместе смысла нет.
 */
function PaymentsPanel() {
  const [rows, setRows] = useState<PaymentItem[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    api
      .payments()
      .then((res) => setRows(res.items))
      .catch((err) => setFailed(err instanceof ApiError ? err.message : "Платежи недоступны."));
  }, []);

  return (
    <div className="panel section-gap" data-testid="payments-panel">
      <h3>Мои платежи</h3>
      <div className="cap">Цена в строке — та, что была на момент покупки</div>
      {failed ? <div className="err">{failed}</div> : null}
      {rows === null && !failed ? <p className="skeleton">Загружаем платежи…</p> : null}
      {rows && rows.length === 0 ? <p className="dim">Платежей пока нет.</p> : null}
      {rows && rows.length ? (
        <ul className="paylist">
          {rows.map((p) => {
            const when = new Date(p.paid_at ?? p.created_at);
            return (
              <li key={p.id} data-testid="payment-row">
                <span className="pw">
                  <b>{p.tariff.name ?? "Тариф"}</b>
                  <span className="small">
                    {when.toLocaleDateString("ru-RU")} {when.toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {p.external_id}
                  </span>
                </span>
                <span className="pa">
                  {money(p.amount)} ₽
                  <span className="small">
                    {p.refunded_at ? "возвращён" : p.paid_at ? "оплачен" : "не оплачен"}
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

function safeCenter(birth: string, sex: "m" | "f"): string {
  try {
    return String(calculate(birth, sex).center);
  } catch {
    return "—";
  }
}
