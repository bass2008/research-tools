"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { when } from "@/lib/moment";
import { ApiError, api, type AdminUserCard } from "@/lib/api";
import { money } from "@/lib/tariffs";
import { paymentTargetLabel } from "@/lib/paytarget";
import { counted, plural } from "@/lib/plural";

import { birthLabel } from "@/components/matrix/MatrixResult";

const ACCESS: Record<string, string> = {
  forever: "куплена навсегда",
  subscription: "по подписке",
  locked: "закрыта",
};

export default function AdminUserView({ id }: { id: number }) {
  const [card, setCard] = useState<AdminUserCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.admin
      .user(id)
      .then(setCard)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Не удалось открыть."));
  }, [id]);

  if (error) {
    return (
      <div className="panel narrow">
        <h3>Не открылось</h3>
        <p className="dim">{error}</p>
        <Link className="btn wide" href="/admin">
          К списку
        </Link>
      </div>
    );
  }
  if (!card) return <p className="skeleton">Загружаем…</p>;

  const u = card.user;
  return (
    <>
      <p className="crumbs">
        <Link href="/admin">Админка</Link> <span>/</span> <span>{u.email}</span>
      </p>
      <h1>{u.email}</h1>

      <div className="panel">
        <h3>Профиль</h3>
        <dl className="kv">
          <dt>Зарегистрирован</dt>
          <dd>{when(u.created_at)}</dd>
          <dt>Последнее появление</dt>
          <dd>{when(u.last_seen_at)}</dd>
          <dt>Куплено навсегда</dt>
          <dd>{u.owned}</dd>
          <dt>Подписка</dt>
          <dd>{u.scopes.includes("all") ? (u.until ? `до ${when(u.until)}` : "активна") : "нет"}</dd>
          <dt>Уплачено</dt>
          <dd>
            {money(u.spent)} ₽ за {counted(u.payments, "платёж", "платежа", "платежей")}
          </dd>
          <dt>Действующих прав</dt>
          <dd>{u.rights}</dd>
        </dl>
      </div>

      <div className="panel section-gap">
        <h3>Матрицы ({card.matrices.length})</h3>
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-user-matrices">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Дата</th>
                <th>Карта</th>
                <th>Доступ</th>
                <th>Сохранена</th>
              </tr>
            </thead>
            <tbody>
              {card.matrices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="dim">
                    Матриц нет.
                  </td>
                </tr>
              ) : (
                card.matrices.map((m) => (
                  <tr key={m.id}>
                    <td>{m.title ?? birthLabel(m.birth)}</td>
                    <td>{birthLabel(m.birth)}</td>
                    <td>{m.sex === "f" ? "женская" : "мужская"}</td>
                    <td>
                      {ACCESS[m.access] ?? m.access}
                      {m.access_until ? ` · до ${when(m.access_until)}` : ""}
                    </td>
                    <td className="small">{when(m.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel section-gap">
        <h3>Платежи ({card.payments.length})</h3>
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-user-payments">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Тариф</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>За какую дату</th>
                <th>Номер</th>
              </tr>
            </thead>
            <tbody>
              {card.payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="dim">
                    Платежей нет.
                  </td>
                </tr>
              ) : (
                card.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="small">{when(p.paid_at ?? p.created_at)}</td>
                    <td>{p.tariff.name ?? "—"}</td>
                    <td className="num">{money(p.amount)} ₽</td>
                    <td>{p.state === "refunded"
                        ? "возвращён"
                        : p.state === "paid"
                          ? "оплачен"
                          : p.state === "abandoned"
                            ? "брошен"
                            : p.state === "failed"
                              ? "не прошёл"
                              : "не оплачен"}</td>
                    <td className="small">{paymentTargetLabel(p)}</td>
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
