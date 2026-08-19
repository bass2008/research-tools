"use client";

// Админка: только чтение. Права проверяет апстрим по списку почт в своём конфиге, поэтому
// «спрятать ссылку» здесь — вопрос удобства, а не безопасности: без админской куки BFF отдаст 404.
import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, api, type AdminPayment, type AdminUser } from "@/lib/api";
import { money } from "@/lib/tariffs";
import { buildInfo } from "@/lib/version";

function when(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([api.admin.users(), api.admin.payments()])
      .then(([u, p]) => {
        setUsers(u.items);
        setPayments(p.items);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Админка недоступна."));
  }, []);

  if (error) {
    return (
      <div className="panel narrow">
        <h3>Админка недоступна</h3>
        <p className="dim">{error}</p>
        <Link className="btn wide" href="/account">
          В кабинет
        </Link>
      </div>
    );
  }

  const paidTotal = (payments ?? [])
    .filter((p) => p.paid_at && !p.refunded_at)
    .reduce((sum, p) => sum + p.amount, 0);

  const build = buildInfo();

  return (
    <>
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
          {users ? `${users.length} всего` : "загружаем…"}
          {payments ? ` · оплачено ${money(paidTotal)} ₽ за ${payments.length} платежей` : ""}
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
                <th>Зарегистрирован</th>
              </tr>
            </thead>
            <tbody>
              {users === null ? (
                <tr>
                  <td colSpan={6} className="skeleton">
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
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-payments">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Почта</th>
                <th>Тариф</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Номер</th>
              </tr>
            </thead>
            <tbody>
              {payments === null ? (
                <tr>
                  <td colSpan={6} className="skeleton">
                    Загружаем…
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="dim">
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
                    <td>{p.refunded_at ? "возвращён" : p.paid_at ? "оплачен" : "не оплачен"}</td>
                    <td className="small">{p.external_id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
