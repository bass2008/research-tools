"use client";

// Админка: только чтение. Права проверяет апстрим по списку почт в своём конфиге, поэтому
// «спрятать ссылку» здесь — вопрос удобства, а не безопасности: без админской куки BFF отдаст 404.
import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, api, type AdminPayment, type AdminReportJob, type AdminUser,
         type SweepRun } from "@/lib/api";
import { when } from "@/lib/moment";
import { money } from "@/lib/tariffs";
import { buildInfo } from "@/lib/version";
import { paymentTargetLabel } from "@/lib/paytarget";
import { counted, plural } from "@/lib/plural";
import AdminPulse from "@/components/admin/AdminPulse";
import AdminSecurityAudit from "@/components/admin/AdminSecurityAudit";
import AdminSettings from "@/components/admin/AdminSettings";

const day = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");

/** Что у пользователя открыто — одной строкой: покупки и подписка живут одновременно. */
function accessLine(u: AdminUser): string {
  const parts: string[] = [];
  if (u.owned > 0) parts.push(`куплено ${u.owned} навсегда`);
  if (u.scopes.includes("all")) parts.push(u.until ? `подписка до ${day(u.until)}` : "подписка");
  return parts.length ? parts.join(" · ") : "нет прав";
}

export default function AdminView() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [jobs, setJobs] = useState<AdminReportJob[] | null>(null);
  const [sweeps, setSweeps] = useState<SweepRun[] | null>(null);
  const [avgSeconds, setAvgSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // доступ закрыт: экран заменяется целиком, частичной админки для постороннего не бывает
  const [denied, setDenied] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<number | null>(null);
  // Отказ возврата живёт отдельно от общей ошибки: раньше он уходил в setError, и вместо сообщения
  // у строки админка целиком подменялась экраном «Админка недоступна» — проверить, прошли ли
  // деньги, становилось нечем.
  const [refundError, setRefundError] = useState<string | null>(null);

  // Возврат необратим и трогает деньги, поэтому спрашиваем подтверждение и называем платёж целиком:
  // у покупателя с двумя оплатами сумма и почта совпадают, и по ним строки не различить.
  const refund = async (p: AdminPayment) => {
    const ok = window.confirm(
      `Вернуть ${money(p.amount)} ₽ покупателю ${p.email}?\n` +
        `Платёж ${p.external_id}, ${paymentTargetLabel(p)}.\n` +
        "Разбор закроется, покупателю уйдёт письмо. Отменить возврат нельзя.",
    );
    if (!ok) return;
    setRefunding(p.id);
    setRefundError(null);
    try {
      const answer = await api.admin.refund(p.id);
      // Сразу правим нажатую строку, чтобы результат возврата был виден без ожидания сети.
      setPayments((rows) =>
        (rows ?? []).map((row) =>
          row.id === p.id
            ? {
                ...row,
                state: "refunded" as const,
                refunded_at: answer.refunded_at ?? new Date().toISOString(),
              }
            : row,
        ),
      );
      // Обе таблицы должны быть одним снимком. Пока перечитывались только люди, платёж,
      // пришедший между открытием админки и возвратом, попадал в покупатели, но отсутствовал
      // в платежах до F5.
      void Promise.allSettled([api.admin.users(), api.admin.payments()]).then(([freshUsers, freshPayments]) => {
        if (freshUsers.status === "fulfilled") setUsers(freshUsers.value.items);
        if (freshPayments.status === "fulfilled") setPayments(freshPayments.value.items);
      });
    } catch (err) {
      setRefundError(err instanceof ApiError ? err.message : "Возврат не прошёл.");
    } finally {
      setRefunding(null);
    }
  };

  // Списки грузятся по отдельности: раньше один Promise.all ронял весь экран целиком, и отказ
  // второстепенной сводки уносил с собой состояние сервера, людей и платежи.
  useEffect(() => {
    const fail = (err: unknown) => {
      // Отказ в доступе — это не «часть данных не пришла»: посторонний не должен видеть ни
      // одной таблицы, даже пустой. Апстрим отвечает 404, а не 403: существование админки
      // он не подтверждает.
      if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
        setDenied(err.message);
        return;
      }
      setError((was) => was ?? (err instanceof ApiError ? err.message : "Часть данных не пришла."));
    };
    void api.admin.users().then((u) => setUsers(u.items)).catch(fail);
    void api.admin.payments().then((p) => setPayments(p.items)).catch(fail);
    void api.admin
      .reports()
      .then((r) => {
        setJobs(r.items);
        setAvgSeconds(r.avg_seconds);
      })
      .catch(fail);
    void api.admin.sweeps().then((s) => setSweeps(s.items)).catch(fail);
  }, []);

  const settled = (payments ?? []).filter((p) => p.state === "paid");
  const paidTotal = settled.reduce((sum, p) => sum + p.amount, 0);

  const build = buildInfo();

  if (denied) {
    return (
      <div className="panel narrow">
        <h3>Админка недоступна</h3>
        <p className="dim">{denied}</p>
        <Link className="btn wide" href="/account">
          В кабинет
        </Link>
      </div>
    );
  }

  return (
    <>
      {error ? (
        <div className="err" role="alert" aria-live="assertive" data-testid="admin-partial-error">
          Часть данных не пришла: {error} Обновите страницу — остальное на экране настоящее.
        </div>
      ) : null}

      <AdminPulse />

      <AdminSecurityAudit />

      <div className="panel">
        <h3>Версия на сервере</h3>
        <div className="cap">Вшита в образ на сборке — совпадает с тем, что реально запущено</div>
        <dl className="kv">
          <dt>Коммит</dt>
          <dd data-testid="build-commit">
            {build.commit} · {build.branch}
          </dd>
          <dt>Собрано</dt>
          <dd>{build.builtAt}</dd>
          <dt>Проверить снаружи</dt>
          <dd>
            <a href="/version/current.txt" target="_blank" rel="noreferrer">
              /version/current.txt
            </a>
          </dd>
        </dl>
      </div>

      <div className="panel section-gap">
        <h3>Пользователи</h3>
        <div className="cap">
          {users ? `${counted(users.length, "человек", "человека", "человек")} всего` : "загружаем…"}
          {payments
            ? ` · оплачено ${money(paidTotal)} ₽ за ` +
              `${counted(settled.length, "платёж", "платежа", "платежей")}` +
              ` · всего ${counted(payments.length, "заявка", "заявки", "заявок")}`
            : ""}
        </div>
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-users">
            <thead>
              <tr>
                <th>Почта</th>
                <th>Матриц</th>
                <th>Платежей</th>
                <th>Уплачено</th>
                <th>Доступ</th>
                <th>Последнее появление</th>
                <th>Зарегистрирован</th>
              </tr>
            </thead>
            <tbody>
              {users === null ? (
                <tr>
                  <td colSpan={7} className="skeleton">
                    Загружаем…
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} data-testid="admin-user-row">
                    <td>
                      <Link href={`/admin/users/${u.id}`}>{u.email}</Link>
                      {u.is_admin ? <span className="badge sub">админ</span> : null}
                    </td>
                    <td>{u.matrices}</td>
                    <td>{u.payments}</td>
                    <td className="num">{money(u.spent)} ₽</td>
                    <td>{accessLine(u)}</td>
                    <td className="small">{when(u.last_seen_at)}</td>
                    <td className="small">{when(u.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel section-gap">
        <h3>Все платежи</h3>
        <div className="cap">Цена в строке — снимок тарифа на момент покупки</div>
        {refundError ? (
          <p className="err" data-testid="refund-error" role="status">
            Возврат не прошёл: {refundError}. Деньги могли не уйти — проверьте строку платежа.
          </p>
        ) : null}
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-payments">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Почта</th>
                <th>Тариф</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>За какую дату</th>
                <th>Номер</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {payments === null ? (
                <tr>
                  <td colSpan={8} className="skeleton">
                    Загружаем…
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="dim">
                    Платежей нет.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} data-testid="admin-payment-row">
                    <td className="small">{when(p.paid_at ?? p.created_at)}</td>
                    <td>
                      <Link href={`/admin/users/${p.user_id}`}>{p.email}</Link>
                    </td>
                    <td>{p.tariff.name ?? "—"}</td>
                    <td className="num">{money(p.amount)} ₽</td>
                    {/* состояние ещё и атрибутом: по тексту проверять ненадёжно — «не оплачен»
                        содержит «оплачен» как подстроку */}
                    <td data-paid={p.state === "paid" ? "1" : "0"}>
                      {p.state === "refunded"
                        ? "возвращён"
                        : p.state === "paid"
                          ? "оплачен"
                          : p.state === "abandoned"
                            ? "брошен"
                            : p.state === "failed"
                              ? "не прошёл"
                              : "не оплачен"}
                    </td>
                    <td className="small">{paymentTargetLabel(p)}</td>
                    <td className="small">{p.external_id}</td>
                    <td className="act">
                      {p.state === "paid" ? (
                        <button
                          type="button"
                          className="btn ghost sm"
                          data-testid="refund"
                          disabled={refunding === p.id}
                          onClick={() => refund(p)}
                        >
                          {refunding === p.id ? "Возвращаем…" : "Вернуть"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel section-gap">
        <h3>Очередь отчётов</h3>
        <div className="cap">
          {jobs === null
            ? "Печать PDF: что запрашивали и сколько это заняло"
            : `Печатей: ${jobs.length} · в работе: ${jobs.filter((j) => j.status === "running").length}` +
              ` · с ошибкой: ${jobs.filter((j) => j.status === "failed").length}` +
              (avgSeconds ? ` · в среднем ${avgSeconds} с` : "")}
        </div>
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-reports">
            <thead>
              <tr>
                <th>Начало</th>
                <th>Почта</th>
                <th>Матрица</th>
                <th>Статус</th>
                <th>Заняло</th>
                <th>Размер</th>
              </tr>
            </thead>
            <tbody>
              {jobs === null ? (
                <tr>
                  <td colSpan={7} className="skeleton">
                    Загружаем…
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="dim">
                    PDF ещё никто не печатал.
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id} data-testid="admin-report-row">
                    <td className="small">{when(j.started_at ?? j.created_at)}</td>
                    <td>
                      <Link href={`/admin/users/${j.user_id}`}>{j.email}</Link>
                    </td>
                    <td className="num">{j.matrix_id}</td>
                    <td title={j.error ?? undefined}>
                      {j.status === "done" ? "готов" : j.status === "running" ? "печатается" : "ошибка"}
                    </td>
                    <td className="num">{j.seconds === null ? "—" : `${j.seconds} с`}</td>
                    <td className="num">
                      {j.size_bytes === null ? "—" : `${Math.round(j.size_bytes / 1024)} КБ`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel section-gap">
        <h3>Досверка платежей</h3>
        <div className="cap">
          {sweeps === null
            ? "Опрос провайдера по платежам, о которых не пришло уведомление"
            : sweeps.length === 0
              ? "Прогонов не было: незакрытых платежей не появлялось"
              : `Прогонов: ${sweeps.length} · последний опросил ${sweeps[0].checked}, ` +
                `изменилось ${sweeps[0].changed}`}
        </div>
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-sweeps">
            <thead>
              <tr>
                <th>Начало</th>
                <th>Статус</th>
                <th>Опрошено</th>
                <th>Изменилось</th>
                <th>Заняло</th>
                <th>Заявки</th>
              </tr>
            </thead>
            <tbody>
              {sweeps === null ? (
                <tr>
                  <td colSpan={7} className="skeleton">
                    Загружаем…
                  </td>
                </tr>
              ) : sweeps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="dim">
                    Пока нечего было досверять.
                  </td>
                </tr>
              ) : (
                sweeps.map((s) => (
                  <tr key={s.id} data-testid="admin-sweep-row">
                    <td className="small">{when(s.started_at)}</td>
                    <td title={s.error ?? undefined}>{s.status === "done" ? "готов" : "идёт"}</td>
                    <td className="num">{s.checked}</td>
                    <td className="num">{s.changed}</td>
                    <td className="num">{s.seconds === null ? "—" : `${s.seconds} с`}</td>
                    <td className="small">
                      {s.log.length === 0
                        ? "—"
                        : s.log
                            .map((row) =>
                              `${row.email}: ${row.was}${row.now ? ` → ${row.now}` : ""}` +
                              (row.error ? ` (${row.error})` : ""),
                            )
                            .join("; ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminSettings />
    </>
  );
}
