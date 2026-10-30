"use client";

import { forLocale as localizedHoldings } from "@/lib/holdings";
import { useAdminLocale, useAdminMessage } from "./useAdminLocale";

import Link from "@/components/ui/LocalizedLink";
import { useEffect, useState } from "react";

import UserActions from "@/components/admin/UserActions";
import { ApiError, type AdminUserCard } from "@/lib/api";


const ACCESS: Record<string, string> = {
  forever: "куплена навсегда",
  granted: "выдана без оплаты",
  subscription: "по подписке",
  locked: "закрыта",
};

export default function AdminUserView({ id }: { id: number }) {
  const { L, t, api, when, money, paymentTargetLabel, counted, birthLabel } = useAdminLocale();
  const { holdingLines } = localizedHoldings(L);
  const [card, setCard] = useState<AdminUserCard | null>(null);
  const [error, setError] = useAdminMessage();

  const load = () => api.admin
    .user(id)
    .then(setCard)
    .catch((err) => setError(err instanceof ApiError ? err : "Не удалось открыть."));

  useEffect(() => {
    void load();
  }, [id, api]);

  if (error) {
    return (
      <div className="panel narrow">
        <h3>{t("Не открылось")}</h3>
        <p className="dim">{error}</p>
        <Link className="btn wide" href="/admin">
          {t("К списку")}</Link>
      </div>
    );
  }
  if (!card) return <p className="skeleton">{t("Загружаем…")}</p>;

  const u = card.user;
  return (
    <>
      <p className="crumbs">
        <Link href="/admin">{t("Админка")}</Link> <span>/</span> <span>{u.email}</span>
      </p>
      <h1>{u.email}</h1>
      {/* выдать дату, пару или подписку можно прямо из карточки, а не только из списка */}
      <div className="panel" data-testid="admin-user-actions">
        <h3>{t("Действия")}</h3>
        <UserActions user={u} onGranted={() => void load()} />
      </div>

      <div className="panel">
        <h3>{t("Профиль")}</h3>
        <dl className="kv">
          <dt>{t("Зарегистрирован")}</dt>
          <dd>{when(u.created_at)}</dd>
          <dt>{t("Последнее появление")}</dt>
          <dd>{when(u.last_seen_at)}</dd>
          <dt>{t("Доступ")}</dt>
          <dd data-testid="admin-user-access">
            {u.holdings?.length
              ? holdingLines(u.holdings).map((line) => <div key={line.text}>{line.text}</div>)
              : t("нет прав")}
          </dd>
          <dt>{t("Уплачено")}</dt>
          <dd>
            {money(u.spent)} {t(" ₽ за ")}{counted(u.payments, "платёж", "платежа", "платежей")}
          </dd>
          <dt>{t("Действующих прав")}</dt>
          <dd>{u.rights}</dd>
        </dl>
      </div>

      <div className="panel section-gap">
        <h3>{t("Матрицы (")}{card.matrices.length})</h3>
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-user-matrices">
            <thead>
              <tr>
                <th>{t("Имя")}</th>
                <th>{t("Дата")}</th>
                <th>{t("Карта")}</th>
                <th>{t("Доступ")}</th>
                <th>{t("Сохранена")}</th>
              </tr>
            </thead>
            <tbody>
              {card.matrices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="dim">
                    {t("Матриц нет.")}</td>
                </tr>
              ) : (
                card.matrices.map((m) => (
                  <tr key={m.id}>
                    <td>{m.title ?? birthLabel(m.birth)}</td>
                    <td>{birthLabel(m.birth)}</td>
                    <td>{m.sex === "f" ? t("женская") : t("мужская")}</td>
                    <td>
                      {t(ACCESS[m.access] ?? m.access)}
                      {m.access_until ? t(" · до {0}", when(m.access_until)) : ""}
                      {m.access === "subscription" && m.access_granted ? t(" · выдана") : ""}
                    </td>
                    <td className="small">{when(m.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(card.readings ?? []).some((r) => r.product === "pair") ? (
        <div className="panel section-gap">
          <h3>{t("Пары (")}{(card.readings ?? []).filter((r) => r.product === "pair").length})</h3>
          <div className="tablewrap">
            <table className="admtable" data-testid="admin-user-pairs">
              <thead><tr><th>{t("Имя")}</th><th>{t("Доступ")}</th><th>{t("Сохранена")}</th></tr></thead>
              <tbody>
                {(card.readings ?? []).filter((r) => r.product === "pair").map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{t(ACCESS[r.access] ?? r.access)}{r.access_until ? t(" · до {0}", when(r.access_until)) : ""}{r.access === "subscription" && r.access_granted ? t(" · выдана") : ""}</td>
                    <td className="small">{when(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="panel section-gap">
        {/* Заголовок называет все записи, включая возвращённые и незавершённые: в сводке
            выше стоит «Уплачено 0 ₽ за 0 платежей», и без уточнения два числа на одном
            экране читались как противоречие. */}
        <h3>{t("Платежи и возвраты (")}{card.payments.length})</h3>
        <div className="tablewrap">
          <table className="admtable" data-testid="admin-user-payments">
            <thead>
              <tr>
                <th>{t("Когда")}</th>
                <th>{t("Тариф")}</th>
                <th>{t("Сумма")}</th>
                <th>{t("Статус")}</th>
                <th>{t("За какую дату")}</th>
                <th>{t("Номер")}</th>
              </tr>
            </thead>
            <tbody>
              {card.payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="dim">
                    {t("Платежей нет.")}</td>
                </tr>
              ) : (
                card.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="small">{when(p.paid_at ?? p.created_at)}</td>
                    <td>{p.tariff.display_name ?? p.tariff.name ?? "—"}</td>
                    <td className="num">{money(p.amount)} ₽</td>
                    <td>{p.state === "refunded"
                        ? t("возвращён")
                        : p.state === "paid"
                          ? t("оплачен")
                          : p.state === "abandoned"
                            ? t("брошен")
                            : p.state === "failed"
                              ? t("не прошёл")
                              : t("не оплачен")}</td>
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
