"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiError, api, type MatrixListItem } from "@/lib/api";
import { calculate } from "@/lib/matrix";
import { loadBirth } from "@/lib/storage";
import { LEAD_ID, money } from "@/lib/tariffs";

import { birthLabel } from "./MatrixResult";
import SaveMatrixButton from "./SaveMatrixButton";
import { useTariffs } from "./TariffsProvider";
import { useSession } from "./useSession";

export default function AccountView() {
  const tariffs = useTariffs();
  const session = useSession();
  const [items, setItems] = useState<MatrixListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
            {plan ? `${plan.name} — ${money(plan.price)} ₽` : "не оплачен"}
            {plan ? "" : " · два раздела открыты бесплатно"}
            {until ? ` · до ${until.toLocaleDateString("ru-RU")}` : ""}
            {plan && !until ? " · бессрочно" : ""}
          </dd>
          <dt>Матрицы</dt>
          <dd>
            {session.used}
            {session.canStore ? " · хранение без ограничений" : " · без права хранения держим одну"}
          </dd>
        </dl>
        <div className="taglist" style={{ marginTop: 12 }}>
          <Link href="/report">Мой разбор</Link>
          <Link href="/#calc">Новый расчёт</Link>
          {/* покупку предлагаем тем, у кого прав нет: ссылка ведёт на существующий тариф */}
          {plan ? null : (
            <Link href={`/pay/${singlePlan?.id ?? LEAD_ID}`}>Открыть полный разбор</Link>
          )}
          <button className="btn ghost sm" data-testid="logout" onClick={() => void session.signOut()}>
            Выйти
          </button>
        </div>
        <p className="hint" style={{ textAlign: "left" }}>
          Доступ к разделам приходит с сервера при каждом открытии страницы: в браузере он не хранится,
          поэтому работает с любого устройства и не открывается правкой localStorage.
        </p>
      </div>

      <div className="panel section-gap">
        <h3>Сохранённые матрицы</h3>
        <div className="cap">Дата рождения уходит на сервер только здесь — по вашему действию</div>
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
              <li className="matrow" key={it.id} data-testid="matrix-card" data-birth={it.birth}>
                <div>
                  <div style={{ fontWeight: 600 }}>{it.title ?? birthLabel(it.birth)}</div>
                  <div className="small">
                    {birthLabel(it.birth)} · {it.sex === "f" ? "женская" : "мужская"} карта · аркан центра{" "}
                    {safeCenter(it.birth, it.sex)}
                  </div>
                </div>
                <Link className="btn ghost sm" href={`/matrices/${it.id}`}>
                  Открыть
                </Link>
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
    </>
  );
}

function safeCenter(birth: string, sex: "m" | "f"): string {
  try {
    return String(calculate(birth, sex).center);
  } catch {
    return "—";
  }
}
