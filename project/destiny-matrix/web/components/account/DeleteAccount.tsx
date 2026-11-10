"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "@/components/ui/LocalizedLink";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ApiError, forLocale as localizedApi, type AccountDeletion } from "@/lib/api";
import { D } from "@/lib/i18n";
import { useMessage } from "@/lib/i18n/useMessage";
import { refreshSession } from "./useSession";
import PasswordSetup from "./PasswordSetup";

export default function DeleteAccount() {
  const locale = useLocale(), en = locale === "en";
  const { api } = localizedApi(locale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [deletion, setDeletion] = useState<AccountDeletion | null>(null);
  const [error, setError] = useMessage(locale);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const pending = await api.accountDeletion().catch(() => null);
        if (pending && !disposed) { setDeletion(pending.deletion); setEmail(pending.user.email); setHasPassword(pending.user.has_password !== false); return; }
        const me = await api.me().catch(() => null);
        if (me && !disposed) { setEmail(me.user.email); setHasPassword(me.user.has_password !== false); setSignedIn(true); }
      } finally { if (!disposed) setLoading(false); }
    })();
    return () => { disposed = true; };
  }, [api]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || (signedIn && !hasPassword && !deletion)) return;
    setBusy(true); setError(null); setRestored(false);
    try {
      if (deletion) {
        await api.restoreAccount();
        setDeletion(null); setSignedIn(true); setRestored(true); setConfirm(false);
      } else if (!signedIn) {
        const result = await api.login(email, password);
        setHasPassword(result.user.has_password !== false);
        if (result.deletion) setDeletion(result.deletion);
        else setSignedIn(true);
      } else {
        const result = await api.deleteAccount(password);
        setDeletion(result.deletion); setSignedIn(false); setConfirm(false);
      }
      setPassword("");
      await refreshSession(locale);
    } catch (cause) {
      setError((L) => cause instanceof ApiError ? cause.messageFor(L) : D.auth.generic[L]);
    } finally { setBusy(false); }
  }

  const date = deletion ? new Date(deletion.delete_at).toLocaleDateString(en ? "en-GB" : "ru-RU", { day: "numeric", month: "long", year: "numeric" }).replace(/\s*г\.$/, "") : "";
  const askPassword = !deletion && (!signedIn || hasPassword);
  const submitLabel = busy ? (en ? "Please wait…" : "Подождите…")
    : deletion ? (en ? "Restore account" : "Восстановить аккаунт")
    : signedIn ? (en ? "Delete account" : "Удалить аккаунт") : (en ? "Sign in" : "Войти");

  return <div className="form narrow" data-testid="account-delete">
    <h1>{deletion ? (en ? "Restore account" : "Восстановление аккаунта") : (en ? "Delete account" : "Удаление аккаунта")}</h1>
    {loading ? <div className="sub">{en ? "Loading…" : "Загрузка…"}</div> : <>
      {deletion ? <div className="sub">{en
        ? <>The account <strong style={{ overflowWrap: "anywhere" }}>{email}</strong> will be deleted on {date}. Until then you can restore it: saved dates, couples and readings stay in place.</>
        : <>Аккаунт <strong style={{ overflowWrap: "anywhere" }}>{email}</strong> будет удалён {date}. До этой даты его можно восстановить — сохранённые даты, пары и разборы останутся.</>}
      </div> : <div className="sub">{en
        ? <>The shared Arcana Sense account is deleted on the website and in the app{signedIn && <> — <strong style={{ overflowWrap: "anywhere" }}>{email}</strong></>}. Saved dates, couples and readings are erased after 30 days; until then the account can be restored by signing in. The period already paid is not refunded, and Google Play renewal stops.</>
        : <>Удаляется общий аккаунт Arcana Sense — на сайте и в приложении{signedIn && <>: <strong style={{ overflowWrap: "anywhere" }}>{email}</strong></>}. Через 30 дней сохранённые даты, пары и разборы сотрутся, а до этого аккаунт можно восстановить, просто войдя в него. Оплаченный период не возвращается, продление Google Play отключается.</>}
      </div>}
      {restored && <p className="okmsg" role="status">{en ? "Account restored. Google Play renewal remains disabled." : "Аккаунт восстановлен. Продление Google Play остаётся выключенным."}</p>}
      {deletion?.renewal_cancellation === "pending" && <p className="hint">{en ? "Cancelling future Google Play charges is still in progress. " : "Отключение будущих списаний Google Play ещё выполняется. "}
        <a href="https://play.google.com/store/account/subscriptions">{en ? "Manage in Google Play" : "Управлять в Google Play"}</a></p>}
      {signedIn && !hasPassword && !deletion && <PasswordSetup email={email} locale={locale} />}
      {(askPassword || deletion) && <form method="post" onSubmit={submit} noValidate>
        {askPassword && <>
          {!signedIn && <>
            <label htmlFor="delete-email">{en ? "Email" : "Почта"}</label>
            <input id="delete-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@mail.ru" />
          </>}
          <label htmlFor="delete-password" style={{ marginTop: signedIn ? 0 : 12 }}>{en ? "Current password" : "Текущий пароль"}</label>
          <input id="delete-password" type="password" autoComplete="current-password" required minLength={3} value={password} onChange={e => setPassword(e.target.value)} />
          {signedIn && <label className="consent">
            <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />
            <span>{en ? "I understand that the account and its data will be deleted." : "Понимаю, что аккаунт и его данные будут удалены."}</span>
          </label>}
        </>}
        <button className="btn wide" style={{ marginTop: 14 }} disabled={busy || (signedIn && !confirm && !deletion)} type="submit">{submitLabel}</button>
        {error && <div className="err" role="alert" aria-live="assertive">{error}</div>}
      </form>}
      {!deletion && <p className="hint">
        {signedIn
          ? <Link href="/account">{en ? "Cancel and go to my account" : "Отмена — вернуться в кабинет"}</Link>
          : <><Link href="/forgot">{en ? "Forgot password?" : "Забыли пароль?"}</Link> · <Link href="/login?return=account-delete">{en ? "Other sign-in options" : "Другие способы входа"}</Link></>}
      </p>}
    </>}
  </div>;
}
