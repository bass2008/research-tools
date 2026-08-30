"use client";

// Журнал безопасности: попытки входа/регистрации/сброса. Отдельно от прочих таблиц админки —
// растёт на каждую попытку, поэтому с фильтром по исходу и постраничной подгрузкой.
import { useEffect, useState } from "react";

import { ApiError, api, type AuditCategory, type SecurityAuditRow } from "@/lib/api";

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

const ACTION: Record<string, string> = { login: "вход", register: "регистрация", reset: "сброс" };
const OUTCOME: Record<string, string> = { success: "успех", failed: "отказ", throttled: "лимит" };

const TABS: { key: AuditCategory; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "success", label: "Успешные" },
  { key: "failed", label: "Неуспешные" },
  { key: "throttled", label: "Отсечённые лимитом" },
];

const SIZES = [10, 25, 50, 100];

export default function AdminSecurityAudit() {
  const [rows, setRows] = useState<SecurityAuditRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState<AuditCategory>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    api.admin
      .securityAudit(category, page, pageSize)
      .then((res) => {
        if (!alive) return;
        // прошлый отказ гасим: панель оставалась с надписью «Сервер не отвечает» после того,
        // как данные уже пришли, — подпись обновлялась, а таблица нет
        setError(null);
        setRows(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof ApiError ? err.message : "Журнал недоступен.");
      });
    return () => {
      alive = false;
    };
  }, [category, page, pageSize]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const pick = (c: AuditCategory) => {
    setCategory(c);
    setPage(1);
  };

  return (
    <div className="panel section-gap">
      <h3>Журнал безопасности</h3>
      <div className="cap">
        Попытки входа, регистрации и сброса пароля: успех, отказ или отсечение лимитом
        {/* сервер считает total уже по фильтру: «всего» читалось как размер всего журнала */}
        {rows ? `${category === "all" ? " · всего " : " · в этом отборе "}${total}` : ""}
      </div>

      <div
        // это фильтр, а не вкладки: внутри tablist ожидаются role="tab" с aria-selected,
        // а здесь кнопки-переключатели — договор не совпадал
        role="group"
        aria-label="Фильтр журнала безопасности"
        data-testid="audit-tabs"
        style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn sm${category === t.key ? "" : " ghost"}`}
            aria-pressed={category === t.key}
            data-testid={`audit-tab-${t.key}`}
            onClick={() => pick(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="err" role="status">
          {error}
        </p>
      ) : (
        <>
          <div className="tablewrap">
            <table className="admtable" data-testid="admin-security-audit">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Событие</th>
                  <th>Исход</th>
                  <th>Почта</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {rows === null ? (
                  <tr>
                    <td colSpan={5} className="skeleton">
                      Загружаем…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="dim">
                      Событий нет.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} data-testid="audit-row" data-outcome={r.outcome}>
                      <td className="small">{when(r.at)}</td>
                      <td>{ACTION[r.action] ?? r.action}</td>
                      <td>{OUTCOME[r.outcome] ?? r.outcome}</td>
                      <td>{r.email ?? "—"}</td>
                      <td className="small">{r.ip ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            data-testid="audit-pager"
            style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}
          >
            <button
              type="button"
              className="btn ghost sm"
              disabled={page <= 1}
              data-testid="audit-prev"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Назад
            </button>
            <span className="dim">
              Стр. {page} из {pages}
            </span>
            <button
              type="button"
              className="btn ghost sm"
              disabled={page >= pages}
              data-testid="audit-next"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Вперёд
            </button>
            <label className="dim">
              На странице:{" "}
              <select
                value={pageSize}
                data-testid="audit-size"
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
