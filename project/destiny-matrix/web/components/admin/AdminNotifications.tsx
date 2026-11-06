"use client";
import { useEffect, useState } from "react";
import Link from "@/components/ui/LocalizedLink";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ApiError, forLocale, type AdminNotificationPage } from "@/lib/api";
import { Pagination } from "@/components/account/Notifications";

export default function AdminNotifications() {
  const L = useLocale(), en = L === "en";
  const [filters, setFilters] = useState({ user_id: "", type: "", read: "", delivered_from: "", delivered_to: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminNotificationPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true; setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    Object.entries(applied).forEach(([key, value]) => { if (value) params.set(key, key.startsWith("delivered_") ? new Date(value).toISOString() : value); });
    void forLocale(L).api.adminNotifications(params).then(r => { if (live) { setData(r); setError(""); } }).catch(e => { if (live) setError(e instanceof ApiError ? e.messageFor(L) : en ? "Unable to load notifications" : "Не удалось загрузить уведомления"); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [L, applied, page]);
  const field = (key: keyof typeof filters, value: string) => setFilters(f => ({ ...f, [key]: value }));
  const when = (value: string) => new Date(value).toLocaleString(en ? "en-GB" : "ru-RU");
  return <section className="panel section-gap" id="notifications" data-testid="admin-notifications">
    <h2>{en ? "User notifications" : "Уведомления пользователей"}</h2>
    <form className="admin-notification-filters" onSubmit={e => { e.preventDefault(); setPage(1); setApplied({ ...filters }); }}>
      <label>{en ? "User ID" : "ID пользователя"}<input type="number" min="1" value={filters.user_id} onChange={e => field("user_id", e.target.value)} /></label>
      <label>{en ? "Type" : "Тип"}<select value={filters.type} onChange={e => field("type", e.target.value)}><option value="">{en ? "All types" : "Все типы"}</option>
        <option value="individual_reading_ready">{en ? "Individual reading ready" : "Индивидуальный разбор готов"}</option><option value="reading_available">{en ? "Reading available" : "Разбор доступен"}</option><option value="subscription_active">{en ? "Subscription active" : "Подписка активна"}</option><option value="subscription_expired">{en ? "Subscription expired" : "Подписка закончилась"}</option><option value="admin_payment_succeeded">{en ? "Admin: payment" : "Администратору: оплата"}</option>
      </select></label>
      <label>{en ? "Read state" : "Прочтение"}<select value={filters.read} onChange={e => field("read", e.target.value)}><option value="">{en ? "All" : "Все"}</option><option value="true">{en ? "Read" : "Прочитано"}</option><option value="false">{en ? "Unread" : "Не прочитано"}</option></select></label>
      <label>{en ? "Delivered from" : "Доставлено с"}<input type="datetime-local" value={filters.delivered_from} onChange={e => field("delivered_from", e.target.value)} /></label>
      <label>{en ? "Delivered before" : "Доставлено до"}<input type="datetime-local" value={filters.delivered_to} onChange={e => field("delivered_to", e.target.value)} /></label>
      <button className="btn sm">{en ? "Apply" : "Показать"}</button>
    </form>
    {error && <p className="err" role="alert">{error}</p>}
    {loading ? <p className="skeleton">{en ? "Loading…" : "Загружаем…"}</p> : <div className="tablewrap"><table className="admtable"><thead><tr><th>{en ? "User" : "Пользователь"}</th><th>{en ? "Notification" : "Уведомление"}</th><th>{en ? "Delivered" : "Доставлено"}</th><th>{en ? "Read" : "Прочитано"}</th></tr></thead><tbody>
      {data?.items.map(item => <tr key={item.delivery_id}><td>#{item.user.id}<br />{item.user.email}</td><td><strong>{item.title}</strong><p style={{ whiteSpace: "pre-line", margin: "6px 0" }}>{item.text}</p><small>#{item.delivery_id} · {en ? "Event" : "Событие"}: {when(item.created_at)}</small><br /><Link href={item.action.href}>{item.action.label} →</Link></td><td>{when(item.delivered_at)}</td><td>{item.read_at ? when(item.read_at) : en ? "Unread" : "Не прочитано"}</td></tr>)}
      {!data?.items.length && <tr><td colSpan={4}>{en ? "No notifications found" : "Уведомления не найдены"}</td></tr>}
    </tbody></table></div>}
    {data && <Pagination page={page} size={data.page_size} total={data.total} onChange={setPage} disabled={loading} />}
  </section>;
}
