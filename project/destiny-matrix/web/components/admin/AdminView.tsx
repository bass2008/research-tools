"use client";

import { useAdminLocale, useAdminMessage } from "./useAdminLocale";

// Админка: только чтение. Права проверяет апстрим по списку почт в своём конфиге, поэтому
// «спрятать ссылку» здесь — вопрос удобства, а не безопасности: без админской куки BFF отдаст 404.
import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, type AdminPayment, type AdminReportJob, type AdminUser,
         type SweepRun } from "@/lib/api";
import { buildInfo } from "@/lib/version";
import AdminPulse from "@/components/admin/AdminPulse";
import AdminSecurityAudit from "@/components/admin/AdminSecurityAudit";
import AdminSettings from "@/components/admin/AdminSettings";
import UserActions from "@/components/admin/UserActions";

const USER_SIZES = [10, 25, 50, 100];

export default function AdminView() {
  const { t, api, when, day, money, paymentTargetLabel, counted } = useAdminLocale();
/** Что у пользователя открыто — одной строкой: покупки и подписка живут одновременно. */
function accessLine(u: AdminUser): string {
  const parts: string[] = [];
  if (u.owned > 0) parts.push(t("куплено {0} навсегда", u.owned));
  if (u.granted > 0) parts.push(t("выдано {0}", u.granted));
  if (u.scopes.includes("all")) parts.push(u.until ? t("подписка до {0}", day(u.until)) : t("подписка"));
  return parts.length ? parts.join(" · ") : t("нет прав");
}


  const [users, setUsers] = useState<AdminUser[] | null>(null);
  // Список растёт, а в каждой строке считаются права и покупки: отдаём страницами, новые сверху.
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSize, setUsersSize] = useState(10);
  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [jobs, setJobs] = useState<AdminReportJob[] | null>(null);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsRunning, setJobsRunning] = useState(0);
  const [jobsFailed, setJobsFailed] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsSize, setJobsSize] = useState(10);
  const [sweeps, setSweeps] = useState<SweepRun[] | null>(null);
  const [avgSeconds, setAvgSeconds] = useState<number | null>(null);
  const [error, setError] = useAdminMessage();
  // доступ закрыт: экран заменяется целиком, частичной админки для постороннего не бывает
  const [denied, setDenied] = useAdminMessage();
  const [refunding, setRefunding] = useState<number | null>(null);
  // Отказ возврата живёт отдельно от общей ошибки: раньше он уходил в setError, и вместо сообщения
  // у строки админка целиком подменялась экраном «Админка недоступна» — проверить, прошли ли
  // деньги, становилось нечем.
  const [refundError, setRefundError] = useAdminMessage();

  // Ссылка на файл подписана и живёт час, поэтому запрашиваем её в момент нажатия, а не держим
  // в таблице: открытая полдня админка иначе отдавала бы просроченные ссылки.
  const [downloading, setDownloading] = useState<number | null>(null);
  const [rebuilding, setRebuilding] = useState<number | null>(null);

  const reloadUsers = () => {
    void api.admin.users(usersPage, usersSize)
      .then((u) => { setUsers(u.items); setUsersTotal(u.total); })
      .catch(() => undefined);
  };

  // Готовый файл живёт в хранилище и сам не обновляется: если в нём оказалось не то, заменить
  // его можно только новой печатью.
  const rebuild = async (job: AdminReportJob) => {
    setRebuilding(job.id);
    setError(null);
    try {
      await api.admin.reportRebuild(job.id);
      await loadReports();
    } catch (err) {
      setError(err instanceof ApiError ? err : "Пересоздать не вышло.");
    } finally {
      setRebuilding(null);
    }
  };

  const download = async (job: AdminReportJob) => {
    setDownloading(job.id);
    setError(null);
    try {
      const { url } = await api.admin.reportLink(job.id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof ApiError ? err : "Файл не отдался.");
      await loadReports();
    } finally {
      setDownloading(null);
    }
  };

  // Возврат необратим и трогает деньги, поэтому спрашиваем подтверждение и называем платёж целиком:
  // у покупателя с двумя оплатами сумма и почта совпадают, и по ним строки не различить.
  const refund = async (p: AdminPayment) => {
    const ok = window.confirm(
      t("Вернуть {0} ₽ покупателю {1}?\n", money(p.amount), p.email) +
        t("Платёж {0}, {1}.\n", p.external_id, paymentTargetLabel(p)) +
        t("Разбор закроется, покупателю уйдёт письмо. Отменить возврат нельзя."),
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
      void Promise.allSettled([api.admin.users(usersPage, usersSize), api.admin.payments()]).then(([freshUsers, freshPayments]) => {
        if (freshUsers.status === "fulfilled") setUsers(freshUsers.value.items);
        if (freshPayments.status === "fulfilled") setPayments(freshPayments.value.items);
      });
    } catch (err) {
      setRefundError(err instanceof ApiError ? err : "Возврат не прошёл.");
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
        setDenied(err);
        return;
      }
      setError((was) => was ?? (err instanceof ApiError ? err : "Часть данных не пришла."));
    };
    void api.admin.payments().then((p) => setPayments(p.items)).catch(fail);

    void api.admin.sweeps().then((s) => setSweeps(s.items)).catch(fail);
  }, [api]);

  // Очередь печати тоже страницами: сводка «в работе / с ошибкой» приходит по всей очереди.
  useEffect(() => {
    void loadReports();
  }, [jobsPage, jobsSize, api]);

  function loadReports() {
    return api.admin.reports(jobsPage, jobsSize)
      .then((r) => {
        setJobs(r.items);
        setJobsTotal(r.total);
        setJobsRunning(r.running);
        setJobsFailed(r.failed);
        setAvgSeconds(r.avg_seconds);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && [401, 403, 404].includes(err.status)) setDenied(err);
        else setError((was) => was ?? "Очередь печати не пришла.");
      });
  }

  // Список людей перезапрашивается при смене страницы и размера — остальные таблицы не трогаем.
  useEffect(() => {
    void api.admin.users(usersPage, usersSize)
      .then((u) => { setUsers(u.items); setUsersTotal(u.total); })
      .catch((err: unknown) => {
        if (err instanceof ApiError && [401, 403, 404].includes(err.status)) setDenied(err);
        else setError((was) => was ?? "Список людей не пришёл.");
      });
  }, [usersPage, usersSize, api]);

  const settled = (payments ?? []).filter((p) => p.state === "paid");
  const paidTotal = settled.reduce((sum, p) => sum + p.amount, 0);

  const build = buildInfo();

  if (denied) {
    return (
      <div className="panel narrow">
        <h3>{t("Админка недоступна")}</h3>
        <p className="dim">{denied}</p>
        <Link className="btn wide" href="/account">
          {t("В кабинет")}</Link>
      </div>
    );
  }

  return (
    <>
      {error ? (
        <div className="err" role="alert" aria-live="assertive" data-testid="admin-partial-error">
          {t("Часть данных не пришла: ")}{error} {t(" Обновите страницу — остальное на экране настоящее.")}</div>
      ) : null}

      <AdminPulse />

      <AdminSecurityAudit />

      <div className="panel">
        <h3>{t("Версия на сервере")}</h3>
        <div className="cap">{t("Вшита в образ на сборке — совпадает с тем, что реально запущено")}</div>
        <dl className="kv">
          <dt>{t("Коммит")}</dt>
          <dd data-testid="build-commit">
            {build.commit} · {build.branch}
          </dd>
          <dt>{t("Собрано")}</dt>
          <dd>{build.builtAt}</dd>
          <dt>{t("Проверить снаружи")}</dt>
          <dd>
            <a href="/version/current.txt" target="_blank" rel="noreferrer">
              /version/current.txt
            </a>
          </dd>
        </dl>
      </div>

      <div className="panel section-gap">
        <h3>{t("Пользователи")}</h3>
        <div className="cap">
          {users ? t("{0} всего", counted(usersTotal, "человек", "человека", "человек")) : t("загружаем…")}
          {payments
            ? t(" · оплачено {0} ₽ за ", money(paidTotal)) +
              `${counted(settled.length, "платёж", "платежа", "платежей")}` +
              t(" · всего {0}", counted(payments.length, "заявка", "заявки", "заявок"))
            : ""}
        </div>
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-users">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("Почта")}</th>
                <th>{t("Матриц")}</th>
                <th>{t("Платежей")}</th>
                <th>{t("Уплачено")}</th>
                <th>{t("Доступ")}</th>
                <th>{t("Последнее появление")}</th>
                <th>{t("Зарегистрирован")}</th>
                <th className="act">{t("Действия")}</th>
              </tr>
            </thead>
            <tbody>
              {users === null ? (
                <tr>
                  <td colSpan={9} className="skeleton">
                    {t("Загружаем…")}</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} data-testid="admin-user-row">
                    <td className="num">{u.id}</td>
                    <td>
                      <Link href={`/admin/users/${u.id}`}>{u.email}</Link>
                      {u.is_admin ? <span className="badge sub">{t("админ")}</span> : null}
                    </td>
                    <td>{u.matrices}</td>
                    <td>{u.payments}</td>
                    <td className="num">{money(u.spent)} ₽</td>
                    <td className="acc">{accessLine(u)}</td>
                    <td className="small">{when(u.last_seen_at)}</td>
                    <td className="small">{when(u.created_at)}</td>
                    <td className="act">
                      <UserActions user={u} onGranted={reloadUsers} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div
          data-testid="users-pager"
          style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}
        >
          <button type="button" className="btn ghost sm" disabled={usersPage <= 1}
                  data-testid="users-prev"
                  onClick={() => setUsersPage((p) => Math.max(1, p - 1))}>
            {t("Назад")}</button>
          <span className="dim">
            {t("Стр. ")}{usersPage} {t(" из ")}{Math.max(1, Math.ceil(usersTotal / usersSize))}
          </span>
          <button type="button" className="btn ghost sm"
                  disabled={usersPage >= Math.ceil(usersTotal / usersSize)}
                  data-testid="users-next"
                  onClick={() => setUsersPage((p) => p + 1)}>
            {t("Вперёд")}</button>
          <label className="dim">
            {t("На странице:")}{" "}
            <select value={usersSize} data-testid="users-size"
                    onChange={(e) => { setUsersSize(Number(e.target.value)); setUsersPage(1); }}>
              {USER_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="panel section-gap">
        <h3>{t("Все платежи")}</h3>
        <div className="cap">{t("Цена в строке — снимок тарифа на момент покупки")}</div>
        {refundError ? (
          <p className="err" data-testid="refund-error" role="status">
            {t("Возврат не прошёл: ")}{refundError}{t(". Деньги могли не уйти — проверьте строку платежа.")}</p>
        ) : null}
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-payments">
            <thead>
              <tr>
                <th>{t("Когда")}</th>
                <th>{t("Почта")}</th>
                <th>{t("Тариф")}</th>
                <th>{t("Сумма")}</th>
                <th>{t("Статус")}</th>
                <th>{t("За какую дату")}</th>
                <th>{t("Номер")}</th>
                <th aria-label={t("Действия")} />
              </tr>
            </thead>
            <tbody>
              {payments === null ? (
                <tr>
                  <td colSpan={8} className="skeleton">
                    {t("Загружаем…")}</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="dim">
                    {t("Платежей нет.")}</td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} data-testid="admin-payment-row">
                    <td className="small">{when(p.paid_at ?? p.created_at)}</td>
                    <td>
                      <Link href={`/admin/users/${p.user_id}`}>{p.email}</Link>
                    </td>
                    <td>{p.tariff.display_name ?? p.tariff.name ?? "—"}</td>
                    <td className="num">{money(p.amount)} ₽</td>
                    {/* состояние ещё и атрибутом: по тексту проверять ненадёжно — «не оплачен»
                        содержит «оплачен» как подстроку */}
                    <td data-paid={p.state === "paid" ? "1" : "0"}>
                      {p.state === "refunded"
                        ? t("возвращён")
                        : p.state === "paid"
                          ? t("оплачен")
                          : p.state === "abandoned"
                            ? t("брошен")
                            : p.state === "failed"
                              ? t("не прошёл")
                              : t("не оплачен")}
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
                          {refunding === p.id ? t("Возвращаем…") : t("Вернуть")}
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
        <h3>{t("Очередь отчётов")}</h3>
        <div className="cap">
          {jobs === null
            ? t("Печать PDF: что запрашивали и сколько это заняло")
            : t("Печатей: {0} · в работе: {1}", jobsTotal, jobsRunning) +
              t(" · с ошибкой: {0}", jobsFailed) +
              (avgSeconds ? t(" · в среднем {0} с", avgSeconds) : "")}
        </div>
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-reports">
            <thead>
              <tr>
                <th>{t("Начало")}</th>
                <th>{t("Почта")}</th>
                <th>{t("Матрица")}</th>
                <th>{t("Статус")}</th>
                <th>{t("Заняло")}</th>
                <th>{t("Размер")}</th>
                <th className="act">{t("Файл")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs === null ? (
                <tr>
                  <td colSpan={7} className="skeleton">
                    {t("Загружаем…")}</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="dim">
                    {t("PDF ещё никто не печатал.")}</td>
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
                      {j.status === "done" ? t("готов") : j.status === "running" ? t("печатается") : j.status === "expired" ? t("файл больше не хранится") : t("ошибка")}
                    </td>
                    <td className="num">{j.seconds === null ? "—" : t("{0} с", j.seconds)}</td>
                    <td className="num">
                      {j.size_bytes === null ? "—" : t("{0} КБ", Math.round(j.size_bytes / 1024))}
                    </td>
                    <td className="act">
                      {j.status === "done" ? (
                        <button
                          type="button"
                          className="btn ghost sm"
                          data-testid="report-download"
                          disabled={downloading === j.id}
                          onClick={() => download(j)}
                        >
                          {downloading === j.id ? t("Готовим…") : t("Скачать")}
                        </button>
                      ) : (
                        <span className="dim">—</span>
                      )}
                      <button
                        type="button"
                        className="btn ghost sm"
                        data-testid="report-rebuild"
                        title={t("Напечатать этот разбор заново")}
                        disabled={rebuilding === j.id || j.status === "running"}
                        onClick={() => rebuild(j)}
                      >
                        {rebuilding === j.id ? t("Печатаем…") : t("Пересоздать")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div
          data-testid="reports-pager"
          style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}
        >
          <button type="button" className="btn ghost sm" disabled={jobsPage <= 1}
                  data-testid="reports-prev"
                  onClick={() => setJobsPage((p) => Math.max(1, p - 1))}>
            {t("Назад")}</button>
          <span className="dim">
            {t("Стр. ")}{jobsPage} {t(" из ")}{Math.max(1, Math.ceil(jobsTotal / jobsSize))}
          </span>
          <button type="button" className="btn ghost sm"
                  disabled={jobsPage >= Math.ceil(jobsTotal / jobsSize)}
                  data-testid="reports-next"
                  onClick={() => setJobsPage((p) => p + 1)}>
            {t("Вперёд")}</button>
          <label className="dim">
            {t("На странице:")}{" "}
            <select value={jobsSize} data-testid="reports-size"
                    onChange={(e) => { setJobsSize(Number(e.target.value)); setJobsPage(1); }}>
              {USER_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="panel section-gap">
        <h3>{t("Досверка платежей")}</h3>
        <div className="cap">
          {sweeps === null
            ? t("Опрос провайдера по платежам, о которых не пришло уведомление")
            : sweeps.length === 0
              ? t("Прогонов не было: незакрытых платежей не появлялось")
              : t("Прогонов: {0} · последний опросил {1}, ", sweeps.length, sweeps[0].checked) +
                t("изменилось {0}", sweeps[0].changed)}
        </div>
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-sweeps">
            <thead>
              <tr>
                <th>{t("Начало")}</th>
                <th>{t("Статус")}</th>
                <th>{t("Опрошено")}</th>
                <th>{t("Изменилось")}</th>
                <th>{t("Заняло")}</th>
                <th>{t("Заявки")}</th>
              </tr>
            </thead>
            <tbody>
              {sweeps === null ? (
                <tr>
                  <td colSpan={7} className="skeleton">
                    {t("Загружаем…")}</td>
                </tr>
              ) : sweeps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="dim">
                    {t("Пока нечего было досверять.")}</td>
                </tr>
              ) : (
                sweeps.map((s) => (
                  <tr key={s.id} data-testid="admin-sweep-row">
                    <td className="small">{when(s.started_at)}</td>
                    <td title={s.error ?? undefined}>{s.status === "done" ? t("готов") : t("идёт")}</td>
                    <td className="num">{s.checked}</td>
                    <td className="num">{s.changed}</td>
                    <td className="num">{s.seconds === null ? "—" : t("{0} с", s.seconds)}</td>
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
