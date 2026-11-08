"use client";

import { useSession } from "@/components/account/useSession";
import { useOfferMode } from "@/components/pay/useOfferMode";
import { forLocale as localizedMatrixResult } from "@/components/matrix/MatrixResult";
import Notifications from "./Notifications";
import { useUnreadCount } from "./NotificationsProvider";
import AccountProfile from "./AccountProfile";
import { useIndividualReadings } from "./useIndividualReadings";
import { Pagination } from "./Notifications";
import { INDIVIDUAL_KINDS, individualDates, type IndividualReading } from "@/lib/individualReading";
import { useTariffs } from "@/components/pay/TariffsProvider";
import AccessBadge from "@/components/account/AccessBadge";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ApiError, forLocale as localizedApi, type ReadingItem } from "@/lib/api";
import { DP } from "@/lib/i18n/dict/pair";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { useMessage, type Message } from "@/lib/i18n/useMessage";
import { forLocale as localizedHoldings } from "@/lib/holdings";
import { forLocale as localizedTariffs } from "@/lib/tariffs";
import { buyHref } from "@/lib/readingLinks";
import ArcanaFan from "@/components/matrix/ArcanaFan";
import ReadingBadges from "@/components/account/ReadingBadges";
import { readingTrio, type Trio } from "@/lib/arcanaTrio";
import { useLinkStatus } from "next/link";
import { useSearchParams } from "next/navigation";
import Link from "@/components/ui/LocalizedLink";
import { useCallback, useEffect, useState } from "react";

function OpenReadingLabel({ locale }: { locale: Locale }) {
  const { pending } = useLinkStatus();
  return (
    <span className="account-open-label" aria-live="polite" aria-busy={pending}>
      {pending ? <span className="account-open-spinner" aria-hidden="true" /> : null}
      {pending ? D.account.opening[locale] : D.account.open[locale]}
    </span>
  );
}

export const forLocale = localized((L: Locale) => {
  const { api } = localizedApi(L);
  const { birthLabel } = localizedMatrixResult(L);
  return { api, birthLabel };
});

/**
 * Подпись матрицы прямо в строке списка: имя, а рядом карандаш. Имя нужно, чтобы список из
 * нескольких дат читался — «Матрица 31 марта 1993» не говорит, чья она.
 */
function MatrixName({ locale: requestedLocale, ...localeProps }: ({
  item: ReadingItem;
  fallback: string;
  onSave: (title: string) => Promise<Message | null>;
}) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const {
    item,
    fallback,
    onSave,
  } = localeProps;

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.title ?? "");
  const [busy, setBusy] = useState(false);
  // отказ печатался внизу панели — на телефоне за краем экрана, а поле при этом закрывалось
  // и выбрасывало набранное имя
  const [failed, setFailed] = useMessage(L);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(null);
    try {
      const problem = await onSave(value.trim());
      if (problem) setFailed(problem);
      else setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <span className="matname">
        <span>{item.title ?? fallback}</span>
        <button
          type="button"
          className="iconbtn"
          data-testid="rename-matrix"
          title={D.account.signMatrix[L]}
          aria-label={D.account.signMatrix[L]}
          onClick={() => {
            setValue(item.title ?? "");
            setFailed(null);
            setEditing(true);
          }}
        >
          ✎
        </button>
      </span>
    );
  }

  return (
    <span className="matname">
      <input
        autoFocus
        data-testid="rename-input"
        maxLength={200}
        value={value}
        placeholder={fallback}
        onChange={(e) => {
          setFailed(null);
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        type="button"
        className="btn sm"
        data-testid="rename-save"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? "…" : D.account.save[L]}
      </button>
      <button type="button" className="iconbtn" title={D.account.cancel[L]} onClick={() => setEditing(false)}>
        ✕
      </button>
      {failed ? (
        <span className="err inline" data-testid="rename-error">
          {failed}
        </span>
      ) : null}
    </span>
  );
}

export default function AccountView({ locale: requestedLocale }: { locale?: Locale } = {}) {
  const activeLocale = useLocale(), L = requestedLocale ?? activeLocale, en = L === "en";
  const { api, birthLabel } = forLocale(L);
  const { holdingLines } = localizedHoldings(L);
  const { priceLabel, periodLabel } = localizedTariffs(L);
  const session = useSession(), mode = useOfferMode(), tariffs = useTariffs();
  const unread = useUnreadCount();
  const params = useSearchParams(), selectedTab = params.get("tab"), selectedFilter = params.get("filter") ?? "";
  const tab = selectedTab === "profile" || selectedTab === "notifications" ? selectedTab : "readings";
  const [filter, setFilter] = useState(["personal", "pair", "individual"].includes(selectedFilter) ? selectedFilter : "all");
  const [items, setItems] = useState<ReadingItem[] | null>(null);
  const [error, setError] = useMessage(L);
  const [note, setNote] = useMessage(L);
  const [removing, setRemoving] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [individualPage, setIndividualPage] = useState(1);
  const showIndividual = filter === "all" || filter === "individual";
  const individual = useIndividualReadings(session.status === "user" && showIndividual, individualPage);
  const reload = useCallback(async () => {
    try { const res = await api.readings(); setItems(res.items); setError(null); }
    catch (err) { setError(locale => err instanceof ApiError ? err.messageFor(locale) : D.account.unavailable[locale]); }
  }, [L]);
  useEffect(() => { if (session.status === "user") void reload(); }, [session.status, session.email, reload]);
  useEffect(() => { if (!note) return; const timer = setTimeout(() => setNote(null), 4000); return () => clearTimeout(timer); }, [note]);
  const selectTab = (value: string) => { const url = new URL(window.location.href); url.searchParams.set("tab", value); window.history.replaceState(null, "", url); };
  const rename = async (id: number, title: string): Promise<Message | null> => {
    try { const row = await api.renameReading(id, title); setItems(prev => prev?.map(x => x.id === id ? { ...x, title: row.title } : x) ?? prev); setNote(locale => D.account.renamed[locale]); return null; }
    catch (err) { return locale => err instanceof ApiError ? err.messageFor(locale) : D.account.renameFailed[locale]; }
  };
  const remove = async (id: number) => {
    if (!window.confirm(en ? "Remove this reading from your account?" : "Удалить разбор из личного кабинета?")) return;
    setRemoving(id);
    try { await api.removeReading(id); await reload(); await session.refresh(); }
    catch (err) { setError(locale => err instanceof ApiError ? err.messageFor(locale) : D.account.unavailable[locale]); }
    finally { setRemoving(null); }
  };
  if (session.status === "loading" && !session.email) return <p className="skeleton">{D.account.checkingAccess[L]}</p>;
  if (session.status !== "user" && !(session.status === "loading" && session.email)) return <div className="panel narrow">
    <h2>{D.account.needSignIn[L]}</h2><p className="dim">{D.account.needSignInText[L]}</p>
    {session.status === "offline" && <p className="err" role="alert">{session.error}</p>}
    <Link className="btn" href="/login">{D.auth.signIn[L]}</Link>
  </div>;
  const subscription = session.holdings.filter(h => h.kind === "subscription");
  const offer = tariffs.find(t => t.id === "month");
  const rows = (items ?? []).filter(row => filter === "all" || row.product === filter);
  const dates = (row: ReadingItem) => {
    if (row.product !== "pair") return birthLabel(row.birth!);
    const a = (row.inputs.a as { birth?: string })?.birth, b = (row.inputs.b as { birth?: string })?.birth;
    return a && b ? `${birthLabel(a)} + ${birthLabel(b)}` : "";
  };
  const symbol = (trio: Trio | null, sign: string) => trio ? <ArcanaFan cards={trio} size="sm" /> : <span className="reading-symbol" aria-hidden="true">{sign}</span>;
  const readingCard = (it: ReadingItem) => {
    const pair = it.product === "pair", open = pair ? `/readings/${it.id}` : `/matrices/${it.id}`;
    const trio = readingTrio({ birth: it.birth, ...it.inputs });
    return <li className={`cabinet-reading ${it.access}`} key={`r${it.id}`} data-testid={pair ? "pair-card" : "matrix-card"} data-product={it.product} data-birth={it.birth} data-access={it.access}>
      <div className="cabinet-reading-kind">{symbol(trio, pair ? "∞" : "✧")}<span className="cabinet-reading-tags"><span>{pair ? DP.kind[L] : D.account.kindPersonal[L]}</span><AccessBadge locale={L} item={it} /></span></div>
      <div className="cabinet-reading-name"><MatrixName locale={L} item={it} fallback={dates(it)} onSave={title => rename(it.id, title)} /></div>
      <p className="small">{dates(it)}</p>
      <div className="cabinet-reading-bottom"><span className="small">{it.access === "locked" ? en ? "Free sections" : "Бесплатные разделы" : en ? "Full reading" : "Полный разбор"}</span><Link href={open}><OpenReadingLabel locale={L} /> →</Link></div>
      {(it.can_delete || (it.access === "locked" && mode === "sell")) && <div className="cabinet-reading-extra">
        {it.can_delete && <button disabled={removing === it.id} className="profile-text-button" onClick={() => void remove(it.id)}>{en ? "Remove from account" : "Удалить из кабинета"}</button>}
        {it.access === "locked" && mode === "sell" && <Link href={buyHref(pair ? "pair" : "personal", it.id)}>{D.nav.buy[L]}</Link>}
      </div>}
    </li>;
  };
  const individualCard = (row: IndividualReading) => {
    const ready = row.status === "done";
    const trio = readingTrio(row.inputs, row.year);
    return <li className="cabinet-reading" key={`i${row.id}`} data-testid="individual-card" data-status={ready ? "done" : "in-progress"}>
      <div className="cabinet-reading-kind">{symbol(trio, "✦")}<span className="cabinet-reading-tags"><span>{en ? "Individual reading" : "Индивидуальный разбор"}</span>
        <ReadingBadges locale={L} item={{ access: "forever" }} inWork={!ready} /></span></div>
      <div className="cabinet-reading-name"><span className="matname"><span>{ready ? row.title : en
        ? `We are writing your ${row.year ? `${row.year} ` : ""}reading` : `Пишем ваш разбор${row.year ? ` на ${row.year} год` : ""}`}</span></span></div>
      <p className="small">{individualDates(row, birthLabel)}</p>
      {!ready && <p className="small">{en ? "We will notify you by email and here in your account when it is ready."
        : "Пришлём уведомление на почту и в кабинет, когда он будет готов."}</p>}
      <div className="cabinet-reading-bottom"><span className="small">{INDIVIDUAL_KINDS[row.kind][L]}{row.year ? (en ? ` for ${row.year}` : ` на ${row.year} год`) : ""}</span>
        {ready && <Link href={row.href}><OpenReadingLabel locale={L} /> →</Link>}</div>
    </li>;
  };
  return <div className="cabinet">
    <header className="cabinet-heading"><div><h1>{D.pages.accountTitle[L]}</h1><p>{en ? "Your readings and discoveries" : "Ваши разборы и открытия"}</p>
      {session.admin && <Link className="btn ghost sm" style={{ marginTop: 12 }} href="/admin">{en ? "Go to administration" : "Перейти в админку"} →</Link>}</div>
      <div className="cabinet-subscription" data-testid="account-access">
        {mode === "free" ? <><strong>{en ? "All readings available" : "Все разборы доступны"}</strong><p>{D.account.allFreeAccess[L]}</p></> : subscription.length ? <>
          <strong className="active">{en ? "Subscription active" : "Подписка активна"}</strong>
          {holdingLines(subscription).map(line => <p key={line.text}>{line.text}</p>)}
        </> : <><strong>{en ? "More with a subscription" : "Больше с подпиской"}</strong><p>{offer ? `${priceLabel(offer)} · ${periodLabel(offer)}` : en ? "Access to all readings" : "Доступ ко всем разборам"}</p>
          {offer && <Link href={`/pay/${offer.id}`}>{en ? "Get a subscription" : "Оформить подписку"} →</Link>}</>}
      </div>
    </header>
    <nav className="cabinet-tabs" aria-label={en ? "Account sections" : "Разделы кабинета"}>{[
      ["readings", en ? "My readings" : "Мои разборы"], ["notifications", en ? "Notifications" : "Уведомления"], ["profile", en ? "Profile" : "Профиль"],
    ].map(([key, label]) => <button key={key} aria-current={tab === key ? "page" : undefined} onClick={() => selectTab(key)}>{label}{key === "notifications" && unread > 0 && <span>{unread}</span>}</button>)}</nav>
    {tab === "profile" ? <AccountProfile /> : tab === "notifications" ? <Notifications /> : <section aria-label={en ? "My readings" : "Мои разборы"}>
      <div className="cabinet-toolbar"><div className="cabinet-filters">{[["all", en ? "All" : "Все"], ["personal", en ? "Personal" : "Личные"], ["pair", en ? "Compatibility" : "Совместимость"], ["individual", en ? "Individual" : "Индивидуальные"]].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
        <div className="cabinet-new"><button className="btn" aria-expanded={newOpen} onClick={() => setNewOpen(v => !v)}>＋ {en ? "New reading" : "Новый разбор"}</button>
          {newOpen && <div className="cabinet-new-menu"><Link href="/#calc">{en ? "Personal reading" : "Личный разбор"}</Link><Link href="/compatibility">{en ? "Compatibility" : "Совместимость"}</Link></div>}
        </div>
      </div>
      {note && <p className="okmsg" role="status" data-testid="account-note">{note}</p>}
      {error && filter !== "individual" && <p className="err" role="alert">{error} <button className="iconbtn" onClick={() => void reload()}>{en ? "Retry" : "Повторить"}</button></p>}
      {individual.error && <p className="err" role="alert">{individual.error}</p>}
      <ul className="cabinet-readings" data-testid="matrices-list">{(() => {
        const regular = filter === "individual" ? [] : rows;
        const extra = showIndividual ? individual.data?.items ?? [] : [];
        const loading = (filter !== "individual" && items === null) || (showIndividual && individual.data === null && !individual.error);
        if (loading && regular.length + extra.length === 0) return <li className="cabinet-empty">{error ? D.account.unavailable[L] : D.account.listLoading[L]}</li>;
        if (regular.length + extra.length === 0) return <li className="cabinet-empty">{filter === "individual"
          ? en ? "No individual readings yet" : "Индивидуальных разборов пока нет"
          : en ? "No saved readings here yet" : "Здесь пока нет сохранённых разборов"}</li>;
        const cards = [
          ...regular.map(it => ({ at: Date.parse(it.created_at), card: readingCard(it) })),
          ...extra.map(row => ({ at: Date.parse(row.approved_at ?? row.created_at), card: individualCard(row) })),
        ];
        return cards.sort((a, b) => (b.at || 0) - (a.at || 0)).map(x => x.card);
      })()}</ul>
      {filter === "individual" && individual.data && <Pagination page={individualPage} size={individual.data.page_size} total={individual.data.total} onChange={setIndividualPage} />}
    </section>}
  </div>;
}
