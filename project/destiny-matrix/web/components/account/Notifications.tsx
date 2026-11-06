"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/ui/LocalizedLink";
import { useLocale } from "@/components/ui/LocaleProvider";
import { useSession } from "./useSession";
import { notificationsChanged, useInbox, useUnreadCount } from "./NotificationsProvider";
import { browserDay } from "@/lib/today";
import { ApiError, forLocale, type NotificationPage } from "@/lib/api";

export function NotificationBell() {
  const L = useLocale(), en = L === "en";
  const session = useSession();
  const count = useUnreadCount();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NotificationPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState({ left: 12, top: 70, maxHeight: 420 });
  const button = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const label = en ? "Notifications" : "Уведомления";
  const load = useCallback(async () => {
    setError("");
    const id = ++request.current;
    setLoading(true);
    try {
      const result = await forLocale(L).api.notifications(page, true);
      if (id !== request.current) return;
      const lastPage = Math.max(1, Math.ceil(result.total / result.page_size));
      if (page > lastPage) { setPage(lastPage); return; }
      setData(result); setError("");
    } catch (e) {
      if (id === request.current) setError(e instanceof ApiError ? e.messageFor(L) : en ? "Unable to load notifications" : "Не удалось загрузить уведомления");
    } finally { if (id === request.current) setLoading(false); }
  }, [L, page, en]);
  useEffect(() => {
    if (!open || session.status !== "user") return;
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("notifications-changed", refresh);
    return () => {
      request.current++;
      window.removeEventListener("notifications-changed", refresh);
    };
  }, [open, load, session.status, session.email]);
  useEffect(() => {
    if (!open) return;
    const positionPopup = () => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(380, window.innerWidth - 24);
      const top = rect.bottom + 10;
      setPosition({ left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        top, maxHeight: Math.max(140, Math.min(480, window.innerHeight - top - 12)) });
    };
    const outside = (e: PointerEvent) => {
      if (!popup.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); button.current?.focus(); }
    };
    positionPopup(); closeButton.current?.focus();
    window.addEventListener("resize", positionPopup);
    window.addEventListener("scroll", positionPopup, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", positionPopup);
      window.removeEventListener("scroll", positionPopup, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  useEffect(() => { setOpen(false); setData(null); setPage(1); }, [session.email]);
  const read = async (id?: number) => {
    if (busy || loading || !data) return;
    setBusy(true); setError("");
    try {
      const { api } = forLocale(L);
      if (id === undefined) await api.readAllNotifications(data.through_id);
      else await api.readNotification(id);
      notificationsChanged();
    } catch (e) { setError(e instanceof ApiError ? e.messageFor(L) : en ? "Please try again" : "Попробуйте ещё раз"); }
    finally { setBusy(false); }
  };
  if (session.status !== "user") return null;
  return <>
    <button ref={button} type="button" className="notification-bell" aria-label={`${label}${count ? ` (${count})` : ""}`}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(v => !v); if (!open) { setPage(1); setData(null); } }}>
      <svg width="21" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>
      {count > 0 && <span>{count > 99 ? "99+" : count}</span>}
    </button>
    {open && createPortal(<div ref={popup} className="notification-popover" role="dialog" aria-label={label} style={position}>
      <div className="notification-popover-heading"><strong>{label}</strong>
        <button ref={closeButton} type="button" className="iconbtn" aria-label={en ? "Close notifications" : "Закрыть уведомления"}
          onClick={() => { setOpen(false); button.current?.focus(); }}>×</button>
      </div>
      <div className="notification-popover-list" aria-busy={loading}>
        {error && <p className="err" role="alert">{error} <button className="profile-text-button" onClick={() => void load()}>{en ? "Retry" : "Повторить"}</button></p>}
        {loading && !data ? <p className="notification-popover-empty">{en ? "Loading…" : "Загружаем…"}</p> : data?.items.length === 0 ? <p className="notification-popover-empty">{en ? "No unread notifications" : "Нет непрочитанных уведомлений"}</p> : data?.items.map(item => <article key={item.delivery_id} className={`notification-preview${item.read_at ? "" : " unread"}`}>
          <div><strong>{item.title}</strong><p>{item.text.replace(/\s+/g, " ").slice(0, 160)}{item.text.replace(/\s+/g, " ").length > 160 ? "…" : ""}</p>
            <Link className="notification-open" href={item.action.href} onClick={() => { setOpen(false); if (!item.read_at) void forLocale(L).api.readNotification(item.delivery_id).then(notificationsChanged, () => undefined); }}>{item.action.label} →</Link></div>
          <button type="button" className="notification-eye" disabled={busy || loading || Boolean(item.read_at)}
            aria-label={item.read_at ? en ? "Read" : "Прочитано" : en ? "Mark as read" : "Прочитать"}
            title={item.read_at ? en ? "Read" : "Прочитано" : en ? "Mark as read" : "Прочитать"} onClick={() => void read(item.delivery_id)}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </article>)}
      </div>
      <footer className="notification-popover-footer">
        {data && <Pagination page={page} total={data.total} size={data.page_size} onChange={setPage} disabled={busy || loading} />}
        <button type="button" className="btn sm" disabled={busy || loading || !data?.unread_count} onClick={() => void read()}>{en ? "Read all" : "Прочитать всё"}</button>
      </footer>
    </div>, document.body)}
  </>;
}

export default function Notifications() {
  const L = useLocale();
  const en = L === "en";
  const { api } = forLocale(L);
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const inbox = useInbox();
  const [ownData, setData] = useState<NotificationPage | null>(null);
  const [localError, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ownLoading, setLoading] = useState(true);
  const defaultPage = page === 1 && !unread;
  const data = defaultPage ? inbox.data : ownData;
  const loading = defaultPage ? inbox.loading : ownLoading;
  const sharedError = defaultPage ? inbox.error : null;
  const error = localError || (sharedError instanceof ApiError ? sharedError.messageFor(L)
    : sharedError ? (en ? "Unable to load notifications" : "Не удалось загрузить уведомления") : "");
  const request = useRef(0);
  const load = useCallback(async () => {
    setError("");
    if (defaultPage) {
      await inbox.refresh();
      return;
    }
    const id = ++request.current;
    setLoading(true);
    try {
      const result = await forLocale(L).api.notifications(page, unread);
      if (id !== request.current) return;
      const lastPage = Math.max(1, Math.ceil(result.total / result.page_size));
      if (page > lastPage) { setPage(lastPage); return; }
      setData(result); setError("");
    }
    catch (e) { if (id === request.current) setError(e instanceof ApiError ? e.messageFor(L) : en ? "Unable to load notifications" : "Не удалось загрузить уведомления"); }
    finally { if (id === request.current) setLoading(false); }
  }, [L, page, unread, defaultPage, inbox.refresh]);
  useEffect(() => {
    if (defaultPage) { setError(""); return; }
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("notifications-changed", refresh);
    return () => {
      request.current++;
      window.removeEventListener("notifications-changed", refresh);
    };
  }, [load, defaultPage]);
  const read = async (id?: number) => {
    if (busy || !data) return;
    setBusy(true);
    setError("");
    try {
      if (id !== undefined) await api.readNotification(id);
      else await api.readAllNotifications(data.through_id);
      notificationsChanged();
    } catch (e) { setError(e instanceof ApiError ? e.messageFor(L) : en ? "Please try again" : "Попробуйте ещё раз"); }
    finally { setBusy(false); }
  };
  const dateKey = (s: string) => new Date(s).toLocaleDateString(en ? "en-GB" : "ru-RU");
  const groupLabel = (s: string) => {
    const dayParts = browserDay();
    const d = new Date(s), today = new Date(dayParts.year, dayParts.month - 1, dayParts.day);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const day = d.toLocaleDateString(en ? "en-GB" : "ru-RU", { day: "numeric", month: "long", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" as const } : {}) });
    return day + (dateKey(s) === dateKey(today.toISOString()) ? en ? " · today" : " · сегодня" : dateKey(s) === dateKey(yesterday.toISOString()) ? en ? " · yesterday" : " · вчера" : "");
  };
  return <section aria-label={en ? "Notifications" : "Уведомления"}>
    <div className="cabinet-toolbar">
      <div className="cabinet-filters">{[false, true].map(value => <button key={String(value)} aria-pressed={unread === value} onClick={() => { setUnread(value); setPage(1); }}>{value ? en ? "Unread" : "Непрочитанные" : en ? "All" : "Все"}</button>)}</div>
      <button className="btn" onClick={() => void read()} disabled={busy || loading || !data?.unread_count}>{en ? "Read all" : "Прочитать все"}</button>
    </div>
    {error && <p className="err" role="alert">{error} <button className="iconbtn" onClick={() => void load()}>{en ? "Retry" : "Повторить"}</button></p>}
    {loading ? <p className="skeleton">{en ? "Loading…" : "Загружаем…"}</p> : data?.items.length === 0 ? <div className="cabinet-empty">{en ? "No notifications here yet" : "Здесь пока нет уведомлений"}</div> : data?.items.map((item, index) => <div key={item.delivery_id}>
      {(index === 0 || dateKey(data.items[index - 1].delivered_at) !== dateKey(item.delivered_at)) && <h3 className="notification-date">{groupLabel(item.delivered_at)}</h3>}
      <article className={`notification-card${item.read_at ? "" : " unread"}`}>
        <div className="notification-title"><h4>{item.title}</h4><time dateTime={item.delivered_at}>{new Date(item.delivered_at).toLocaleTimeString(en ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" })}</time></div>
        <p>{item.text}</p>
        <div className="notification-actions"><Link href={item.action.href} onClick={() => { if (!item.read_at) void read(item.delivery_id); }}>{item.action.label} →</Link>
          {!item.read_at && <button className="iconbtn" disabled={busy} onClick={() => void read(item.delivery_id)}>{en ? "Mark as read" : "Прочитано"}</button>}</div>
      </article>
    </div>)}
    {data && <Pagination page={page} total={data.total} size={data.page_size} onChange={setPage} disabled={loading} />}
  </section>;
}

export function Pagination({ page, total, size, onChange, disabled = false }: { page: number; total: number; size: number; onChange: (page: number) => void; disabled?: boolean }) {
  const en = useLocale() === "en";
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages === 1 && page === 1) return null;
  return <nav className="cabinet-pagination" aria-label={en ? "Pagination" : "Страницы"}>
    <button className="btn ghost sm" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>← {en ? "Previous" : "Назад"}</button>
    <span>{page} / {pages} · {en ? "total" : "всего"} {total}</span>
    <button className="btn ghost sm" disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}>{en ? "Next" : "Далее"} →</button>
  </nav>;
}
