"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import { BirthPicker, PairPicker, isoOf, type PickedDate } from "@/components/pay/BirthPicker";
import { Pagination } from "@/components/account/Notifications";
import { ApiError, forLocale } from "@/lib/api";
import { INDIVIDUAL_KINDS, individualKind, type IndividualKind } from "@/lib/individualReading";
import type { IndividualPage, IndividualReading } from "@/lib/individualReading";
import RegisteredUserPicker from "./RegisteredUserPicker";
import type { Sex } from "@/lib/matrix";
import { browserDay } from "@/lib/today";

export default function AdminIndividualReadings() {
  const L = useLocale(), en = L === "en", { api } = forLocale(L);
  const [data, setData] = useState<IndividualPage | null>(null);
  const [page, setPage] = useState(1), [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [note, setNote] = useState("");
  const requestDialog = useRef<HTMLDialogElement>(null);
  const [adding, setAdding] = useState(false), [userId, setUserId] = useState<number | null>(null);
  const [kind, setKind] = useState<IndividualKind>("personal");
  const [annual, setAnnual] = useState(false), [year, setYear] = useState(() => browserDay().year);
  const product = INDIVIDUAL_KINDS[kind].product;
  const [locale, setLocale] = useState(L), [comment, setComment] = useState("");
  const [person, setPerson] = useState<{ date: PickedDate; sex: Sex } | null>(null);
  const [pair, setPair] = useState<{ a: PickedDate; b: PickedDate } | null>(null);
  const labels = { pending: en ? "Pending" : "В работе", review: en ? "Review" : "На проверке", done: en ? "Done" : "Готов" };
  const failure = useCallback((e: unknown) => setError(e instanceof ApiError ? e.messageFor(L) : en ? "Unable to complete the action. Check the data." : "Не удалось выполнить действие. Проверьте данные."), [L, en]);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.adminIndividualReadings(page, status)); }
    catch (e) { failure(e); }
    finally { setLoading(false); }
  }, [api, page, status, failure]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (adding) requestDialog.current?.showModal();
    else requestDialog.current?.close();
  }, [adding]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNote("");
    try { await action(); await load(); }
    catch (e) { failure(e); }
    finally { setBusy(false); }
  }
  function create() {
    return run(async () => {
      const inputs = product === "personal" && person ? { birth: isoOf(person.date), sex: person.sex }
        : pair ? { a: { birth: isoOf(pair.a) }, b: { birth: isoOf(pair.b) } } : {};
      await api.createIndividualReading({ userId: userId!, kind, product, year: annual && product === "personal" ? year : null, inputs, locale, comment });
      setAdding(false); setUserId(null); setComment(""); setStatus(""); setPage(1);
      setNote(en ? "Request added" : "Заявка добавлена");
    });
  }
  // The tab opens inside the click; the short-lived link arrives a moment later.
  function openLater(load: () => Promise<{ url: string }>) {
    const tab = window.open("", "_blank");
    load().then(({ url }) => {
      const target = new URL(url, window.location.origin).href;
      if (tab) tab.location.href = target; else window.location.href = target;
    }).catch((e: unknown) => { tab?.close(); failure(e); });
  }
  function approve(row: IndividualReading) {
    if (!window.confirm(en ? "Approve this article and notify its owner?" : "Одобрить статью и отправить уведомление владельцу?")) return;
    void run(async () => {
      const result = await api.approveIndividualReading(row.id);
      setNote(result.email_errors ? (en ? "Approved. The email could not be sent; the article is available in the account." : "Одобрено. Письмо не отправилось; статья доступна в кабинете.")
        : en ? "Approved. The owner has been notified." : "Одобрено. Владельцу отправлено уведомление.");
    });
  }
  return <section className="panel section-gap" id="individual-readings" data-testid="admin-individual-readings">
    <div className="cabinet-toolbar"><div><h2>{en ? "Individual readings" : "Индивидуальные разборы"}</h2></div>
      <button className="btn sm" disabled={busy} onClick={() => { setError(""); setUserId(null); setAdding(true); }}>{en ? "Add individual reading" : "Добавить индивидуальный разбор"}</button></div>
    <dialog ref={requestDialog} className="modal individual-request-dialog" aria-labelledby="individual-request-title"
      onCancel={e => { if (busy) e.preventDefault(); else setAdding(false); }}
      onClick={e => { if (e.target === e.currentTarget && !busy) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setAdding(false); } }}>
    {adding && <form className="individual-request" onSubmit={e => { e.preventDefault(); void create(); }}>
      <div className="cabinet-toolbar"><h2 id="individual-request-title">{en ? "Add individual reading" : "Добавить индивидуальный разбор"}</h2>
        <button type="button" className="profile-text-button" aria-label={en ? "Close" : "Закрыть"} disabled={busy} onClick={() => setAdding(false)}>✕</button></div>
      <RegisteredUserPicker value={userId} onChange={setUserId} disabled={busy} />
      <label>{en ? "Reading type" : "Тип разбора"}<select value={kind} disabled={busy} onChange={e => setKind(e.target.value as IndividualKind)}>{Object.entries(INDIVIDUAL_KINDS).map(([key, text]) => <option key={key} value={key}>{text[L]}</option>)}</select></label>
      {product === "personal" && <div className="individual-period-fields">
        <label>{en ? "Period" : "Период"}<select value={annual ? "year" : "general"} disabled={busy} onChange={e => setAnnual(e.target.value === "year")}>
          <option value="general">{en ? "General" : "Обычный"}</option><option value="year">{en ? "Annual" : "На год"}</option>
        </select></label>
        {annual && <label>{en ? "Year" : "Год"}<input type="number" required min={1900} max={2200} value={year || ""} disabled={busy} onChange={e => setYear(Number(e.target.value))} /></label>}
      </div>}
      <label>{en ? "Article language" : "Язык статьи"}<select value={locale} disabled={busy} onChange={e => setLocale(e.target.value as "ru" | "en")}><option value="ru">Русский</option><option value="en">English</option></select></label>
      {product === "personal" ? <BirthPicker locale={L} initial={null} ready disabled={busy} onChange={setPerson} />
        : <PairPicker locale={L} initial={null} ready disabled={busy} onChange={setPair} />}
      <label>{product === "pair" ? (en ? "Who they are to each other and the question (optional)" : "Кто они друг другу и вопрос (необязательно)") : (en ? "Comment (optional)" : "Комментарий (необязательно)")}<textarea rows={4} maxLength={10000} value={comment} disabled={busy} onChange={e => setComment(e.target.value)} /></label>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="modal-act"><button type="button" className="btn ghost sm" disabled={busy} onClick={() => setAdding(false)}>{en ? "Cancel" : "Отмена"}</button>
      <button className="btn sm" disabled={busy || !userId || (product === "personal" ? !person : !pair)}>{en ? "Create request" : "Создать заявку"}</button></div>
    </form>}
    </dialog>
    {error && !adding && <p className="err" role="alert">{error}</p>}{note && <p className="okmsg" role="status">{note}</p>}
    <div className="admin-notification-filters"><label>{en ? "Status" : "Статус"}<select value={status} disabled={busy} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">{en ? "All" : "Все"}</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
    {loading ? <p className="skeleton">{en ? "Loading…" : "Загружаем…"}</p> : <div className="tablewrap"><table className="admtable"><thead><tr>
      <th>ID</th><th>{en ? "User / dates" : "Пользователь / даты"}</th><th>{en ? "Status" : "Статус"}</th><th>{en ? "Article" : "Статья"}</th><th>{en ? "Actions" : "Действия"}</th>
    </tr></thead><tbody>{data?.items.map(row => <tr key={row.id} data-individual-id={row.id}>
      <td>{row.id}<br /><small>{new Date(row.created_at).toLocaleDateString(en ? "en-GB" : "ru-RU")}</small></td>
      <td>{row.email}<br /><small>{individualKind(row, L)}</small><br /><small>{row.product === "personal" ? String(row.inputs.birth) : `${(row.inputs.a as { birth: string }).birth} + ${(row.inputs.b as { birth: string }).birth}`} · {row.locale.toUpperCase()}</small>{row.comment && <p>{row.comment}</p>}</td>
      <td>{labels[row.status]}</td>
      <td>{row.status !== "pending" ? <><Link href={row.href}>{row.title || (en ? "Open" : "Открыть")}</Link><br />
        <button type="button" className="profile-text-button" data-testid="individual-preview" onClick={() => openLater(() => api.individualPreview(row.id))}>{en ? "PDF preview" : "Предпросмотр PDF"}</button></> : "—"}</td>
      <td><div className="individual-actions">
        {row.status === "review" && <button className="btn sm" disabled={busy} onClick={() => approve(row)}>{en ? "Approve" : "Одобрить"}</button>}
        {row.status !== "pending" && <button className="btn ghost sm" data-testid="individual-admin-pdf" disabled={busy}
          onClick={() => openLater(() => api.individualPdf(row.id))}>{en ? "Download PDF" : "Скачать PDF"}</button>}</div></td>
    </tr>)}{!data?.items.length && <tr><td colSpan={5}>{en ? "No requests" : "Заявок пока нет"}</td></tr>}</tbody></table></div>}
    {data && <Pagination page={page} total={data.total} size={data.page_size} onChange={setPage} disabled={busy || loading} />}
  </section>;
}
