"use client";

import ActionsMenu from "./ActionsMenu";
import { useEffect, useState } from "react";
import { ApiError, type WorkTask, type WorkerStatus } from "@/lib/api";
import { useAdminLocale } from "./useAdminLocale";

const KINDS: Record<string, string> = { test: "Тестовая задача" };
const STATUS: Record<WorkTask["status"], string> = {
  queued: "в очереди", signalled: "у исполнителя", done: "готово", failed: "ошибка",
};

export default function AdminTasks() {
  const { t, when, api } = useAdminLocale();
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState<WorkTask[] | null>(null);
  const [pending, setPending] = useState(0);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pages = Math.max(1, Math.ceil(total / 20));

  function load() {
    return api.admin.tasks(page)
      .then((r) => { setTasks(r.items); setPending(r.pending); setWorker(r.worker); setTotal(r.total); setError(null); })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : t("Очередь задач не пришла.")));
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [api, page]);

  async function act(action: () => Promise<unknown>, resetPage = false) {
    setBusy(true);
    try {
      await action();
      if (resetPage && page !== 1) setPage(1);
      else await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Не удалось изменить задачу."));
    } finally { setBusy(false); }
  }

  const now = Date.now();
  return (
    <div className="panel section-gap" data-testid="admin-tasks">
      <h3>
        {t("Очередь задач")}{" "}
        {worker ? <span className={`badge ${worker.online ? "sub" : "down"}`} data-testid="admin-worker-status"
          data-online={worker.online}
          title={worker.last_seen_at ? t("Исполнитель приходил за задачами: {0}", when(worker.last_seen_at))
            : t("Исполнитель ещё не приходил за задачами")}>
          {worker.online ? t("Исполнитель: онлайн") : t("Исполнитель: офлайн")}
        </span> : null}
      </h3>
      <div className="cap">
        {t("Ждут исполнителя: {0}. Исполнитель — Claude Code или Codex с MCP arcana-tasks, см. worker/README.md", pending)}
      </div>
      {error ? <p className="err">{error}</p> : null}
      <div style={{ margin: "8px 0" }}>
        <ActionsMenu testId="task-add" label={t("Добавить ▾")} className="btn sm" busy={busy}
          actions={[{ label: t("Тестовая задача"), testId: "task-add-test",
            onSelect: () => void act(() => api.admin.createTestTask(), true) }]} />
      </div>
      <div className="tablewrap">
        <table className="admtable">
          <thead>
            <tr>
              <th>№</th>
              <th>{t("Тип")}</th>
              <th>{t("Статус")}</th>
              <th>{t("Разбор")}</th>
              <th>{t("Причина")}</th>
              <th>{t("Ключи")}</th>
              <th>{t("Создана")}</th>
              <th>{t("Срок")}</th>
              <th>{t("Готова")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tasks === null ? (
              <tr><td colSpan={10} className="skeleton">{t("Загружаем…")}</td></tr>
            ) : tasks.length === 0 ? (
              <tr><td colSpan={10} className="dim">{t("Задач пока не было.")}</td></tr>
            ) : tasks.map((task) => {
              const late = task.status !== "done" && Date.parse(task.due_at) < now;
              return (
                <tr key={task.id} data-testid="admin-task-row" data-status={task.status}>
                  <td className="num">{task.id}</td>
                  <td>{t(KINDS[task.kind] ?? task.kind)}</td>
                  <td title={task.error ?? task.problems.join("\n") ?? undefined}>
                    {t(STATUS[task.status])}{task.attempts > 1 ? ` · ${task.attempts}` : ""}
                    {task.params.response ? <div className="small">{task.params.response}</div> : null}
                    {task.error ? <div className="small dim">{task.error}</div> : null}
                  </td>
                  <td className="num">{task.reading_id ?? "—"}</td>
                  <td className="small">{task.reason ? t(task.reason) : "—"}</td>
                  <td className="small mono">{(task.params.keys ?? []).join(" ")}</td>
                  <td className="small">{when(task.created_at)}</td>
                  <td className={`small${late ? " err" : ""}`}>{when(task.due_at)}{late ? ` · ${t("просрочена")}` : ""}</td>
                  <td className="small">{task.finished_at ? when(task.finished_at) : "—"}</td>
                  <td>
                    <ActionsMenu testId={`task-actions-${task.id}`} busy={busy} actions={[
                      ...(task.status === "failed" || task.status === "signalled" ? [{
                        label: t("В очередь"), testId: `task-retry-${task.id}`,
                        onSelect: () => void act(() => api.admin.retryTask(task.id)),
                      }] : []),
                      { label: t("Удалить"), testId: `task-delete-${task.id}`, onSelect: () => {
                        if (window.confirm(t("Удалить задачу №{0}?", task.id))) {
                          void act(() => api.admin.deleteTask(task.id), true);
                        }
                      } },
                    ]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div data-testid="admin-tasks-pager"
          style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <button type="button" className="btn ghost sm" disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}>{t("Назад")}</button>
          <span className="dim">{t("Стр. ")}{page} {t(" из ")}{pages}</span>
          <button type="button" className="btn ghost sm" disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}>{t("Вперёд")}</button>
        </div>
      ) : null}
    </div>
  );
}
