"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, type AdminUser, type AdminVisit } from "@/lib/api";
import { useAdminLocale, useAdminMessage } from "./useAdminLocale";

export default function UserVisits({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { t, api, when } = useAdminLocale();
  const [items, setItems] = useState<AdminVisit[] | null>(null);
  const [error, setError] = useAdminMessage();
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();

  useEffect(() => {
    let active = true;
    setItems(null);
    setError(null);
    void api.admin.visits(user.id).then((result) => {
      if (active) setItems(result.items);
    }).catch((err) => {
      if (active) setError(err instanceof ApiError ? err : "Не удалось загрузить визиты.");
    });
    return () => { active = false; };
  }, [api, user.id]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const copy = async (value: string) => {
    setCopyFailed(false);
    try { await navigator.clipboard.writeText(value); setCopied(value); }
    catch { setCopyFailed(true); }
  };

  return createPortal(
    <div className="modal-back" onMouseDown={() => onClose()}>
      <div className="modal visits-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}
        tabIndex={-1} ref={dialog} data-testid="user-visits-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <h4 id={titleId}>{t("Визиты: {0}", user.email)}</h4>
        <p className="cap">{t("Одна строка — один ClientID браузера. Даты показывают первое и последнее обнаружение на сайте, а не отдельные визиты Метрики.")}</p>
        {error ? <p className="err" role="alert">{error}</p> : items === null ? <p role="status">{t("Загрузка…")}</p>
          : items.length === 0 ? <p>{t("ClientID пока не получен. Он появится после посещения с авторизацией и доступной Метрикой.")}</p>
          : <div className="visits-scroll"><table className="admin-table">
            <thead><tr><th>ClientID</th><th>{t("Счётчик")}</th><th>{t("Сайт")}</th>
              <th>{t("Впервые замечен")}</th><th>{t("Последний раз")}</th></tr></thead>
            <tbody>{items.map((item) => <tr key={`${item.counter_id}:${item.client_id}`}>
              <td><code>{item.client_id}</code> <button type="button" className="btn ghost sm"
                aria-label={t("Скопировать ClientID {0}", item.client_id)} onClick={() => void copy(item.client_id)}>
                {copied === item.client_id ? t("Скопировано") : t("Копировать")}</button></td>
              <td>{item.counter_id}</td><td>{item.site_origin}</td>
              <td>{when(item.first_seen_at)}</td><td>{when(item.last_seen_at)}</td>
            </tr>)}</tbody>
          </table></div>}
        {copyFailed ? <p role="status">{t("Не удалось скопировать. Выделите ClientID и скопируйте вручную.")}</p> : null}
        <button type="button" className="btn ghost sm" onClick={onClose}>{t("Закрыть")}</button>
      </div>
    </div>, document.body,
  );
}
