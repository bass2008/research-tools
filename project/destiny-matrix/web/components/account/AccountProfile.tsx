"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import { ApiError, forLocale, type MeResponse } from "@/lib/api";
import { useMessage } from "@/lib/i18n/useMessage";
import { operationText, profileNotices } from "@/lib/i18n/dict/accountOperations";
import { useSession } from "./useSession";
import PasswordSetup from "./PasswordSetup";

export default function AccountProfile() {
  const L = useLocale();
  const en = L === "en";
  const { api } = forLocale(L);
  const session = useSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [form, setForm] = useState<"password" | "email" | null>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useMessage(L);
  const [notice, setNotice] = useState<keyof typeof profileNotices | null>(null);
  const [place, setPlace] = useState<"email" | "password" | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const reload = () => api.me().then(setMe);

  useEffect(() => {
    void reload().catch(e => setError(locale =>
      e instanceof ApiError ? e.messageFor(locale) : operationText.loadFailed[locale]));
  }, [L, session.email]);

  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  function changeForm(value: typeof form) {
    setForm(value);
    setOldPassword("");
    setPassword("");
    setRepeat("");
    setError(null);
    setNotice(null);
  }

  function startCooldown(seconds: number) {
    const sentAt = Date.now();
    setNow(sentAt);
    setRetryAt(sentAt + seconds * 1000);
  }

  // The three handlers below share only their pending/error and profile refresh lifecycle.
  async function runOperation(at: "email" | "password", action: () => Promise<void>) {
    if (busy) return;
    setError(null);
    setNotice(null);
    setPlace(at);
    setBusy(true);
    try {
      await action();
      await reload();
    } catch (e) {
      setError(locale => e instanceof ApiError ? e.messageFor(locale) : operationText.failed[locale]);
    } finally {
      setBusy(false);
    }
  }

  function verifyEmail() {
    return runOperation("email", async () => {
      const result = await api.verifyEmail();
      if ("already_verified" in result) return;
      startCooldown(result.retry_after_seconds);
      setNotice("verify");
    });
  }

  function changeEmail() {
    return runOperation("email", async () => {
      const result = await api.changeEmail(email, oldPassword);
      startCooldown(result.retry_after_seconds);
      setForm(null);
      setOldPassword("");
      setNotice("email");
    });
  }

  function changePassword() {
    if (busy) return;
    if (password !== repeat) {
      setNotice(null);
      setPlace("password");
      setError(operationText.mismatch);
      return;
    }
    return runOperation("password", async () => {
      await api.changePassword(oldPassword, password);
      setForm(null);
      setPassword("");
      setRepeat("");
      setOldPassword("");
      setNotice("password");
      await session.refresh();
    });
  }

  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const pending = me?.pending_email_change;
  const hasPassword = me?.user.has_password !== false;
  const verified = Boolean(me?.user.email_verified_at);
  const verificationLabel = verified
    ? (en ? "Verified" : "Подтверждена")
    : (en ? "Not verified" : "Не подтверждена");
  const verifyButtonLabel = remaining
    ? `${en ? "Resend in" : "Повторить через"} ${remaining} ${en ? "s" : "с"}`
    : (en ? "Confirm email" : "Подтвердить почту");
  const message = (at: "email" | "password") => place === at && (error
    ? <p className="err" role="alert">{error}</p>
    : notice && <p className="okmsg" role="status">{profileNotices[notice][L]}</p>);

  return (
    <section className="cabinet-profile">
      {error && !place && <p className="err" role="alert">{error}</p>}
      <div className="cabinet-profile-panel">
        <h2>{en ? "Email" : "Почта"}</h2>
        <div className="profile-row">
          <div>
            <strong>{session.email}</strong>
            <p className="small">{verificationLabel}</p>
          </div>
          {!session.admin && (
            <button className="btn ghost sm" disabled={busy} onClick={() => changeForm(form === "email" ? null : "email")}>
              {en ? "Change" : "Изменить"}
            </button>
          )}
        </div>
        {me && !verified && !pending && (
          <button className="profile-text-button" disabled={busy || remaining > 0} onClick={() => void verifyEmail()}>
            {verifyButtonLabel}
          </button>
        )}
        {pending && (
          <div className="profile-pending">
            <strong>{en ? "Awaiting confirmation" : "Ожидает подтверждения"}: {pending.new_email}</strong>
            <p>
              {en ? "Link expires" : "Ссылка действует до"}{" "}
              {new Date(pending.expires_at).toLocaleString(en ? "en-GB" : "ru-RU")}
            </p>
            <p>
              {pending.new_confirmed
                ? (en ? "New address confirmed." : "Новый адрес подтверждён.")
                : (en ? "Confirm the new address." : "Подтвердите новый адрес.")}
              {pending.require_old_confirmation && !pending.old_confirmed && (
                <> {en ? "Approve the change from the current address too." : "Также разрешите смену с текущего адреса."}</>
              )}
            </p>
          </div>
        )}
        {form !== "email" && message("email")}
        {form === "email" && !hasPassword && <PasswordSetup email={me!.user.email} locale={L} />}
        {form === "email" && hasPassword && (
          <form className="profile-form" onSubmit={e => { e.preventDefault(); void changeEmail(); }}>
            <label>
              {en ? "New email" : "Новая почта"}
              <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <label>
              {en ? "Current password" : "Текущий пароль"}
              <input type="password" autoComplete="current-password" required value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
            </label>
            <p className="small">{operationText.emailChangeHelp[L]}</p>
            {message("email")}
            <button className="btn" disabled={busy || remaining > 0}>
              {busy ? "…" : en ? "Send confirmation" : "Отправить подтверждение"}
            </button>
            <Link href="/forgot">{en ? "Forgot your password?" : "Не знаете пароль?"}</Link>
          </form>
        )}
      </div>
      <div className="cabinet-profile-panel">
        <h2>{en ? "Sign-in and security" : "Вход и безопасность"}</h2>
        <div className="profile-row">
          <div>
            <strong>{en ? "Password" : "Пароль"}</strong>
          </div>
          <button className="btn ghost sm" disabled={busy} onClick={() => changeForm(form === "password" ? null : "password")}>
            {hasPassword ? (en ? "Change" : "Изменить") : (en ? "Set password" : "Создать пароль")}
          </button>
        </div>
        {form !== "password" && message("password")}
        {form === "password" && !hasPassword && <PasswordSetup email={me!.user.email} locale={L} />}
        {form === "password" && hasPassword && (
          <form className="profile-form" onSubmit={e => { e.preventDefault(); void changePassword(); }}>
            <label>
              {en ? "Current password" : "Текущий пароль"}
              <input type="password" autoComplete="current-password" required value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
            </label>
            <label>
              {en ? "New password" : "Новый пароль"}
              <input type="password" autoComplete="new-password" minLength={3} maxLength={200} required value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            <label>
              {en ? "Repeat new password" : "Повторите новый пароль"}
              <input type="password" autoComplete="new-password" minLength={3} required value={repeat} onChange={e => setRepeat(e.target.value)} />
            </label>
            {message("password")}
            <button className="btn" disabled={busy}>{busy ? "…" : en ? "Save password" : "Сохранить пароль"}</button>
            <Link href="/forgot">{en ? "Forgot your password?" : "Не знаете пароль?"}</Link>
          </form>
        )}
      </div>
      {me?.google_play_subscriptions?.some(row => row.access) && <div className="cabinet-profile-panel">
        <h2>Google Play</h2>
        {me.google_play_subscriptions.filter(row => row.access).map(row => <p key={row.order_id}>
          {row.auto_renewing ? (en ? "Renews automatically" : "Продлевается автоматически") : (en ? "Renewal is disabled" : "Автопродление выключено")}
          {row.expires_at && <> · {new Date(row.expires_at).toLocaleDateString(en ? "en-GB" : "ru-RU")}</>}
        </p>)}
        <a href="https://play.google.com/store/account/subscriptions">{en ? "Manage in Google Play" : "Управлять в Google Play"}</a>
      </div>}
      {!session.admin && <div className="cabinet-profile-panel">
        <h2>{en ? "Delete account" : "Удаление аккаунта"}</h2>
        <div className="profile-row">
          <div>
            <p className="small">{en
              ? "Saved dates, pairs and readings are deleted after 30 days. Until then the account can be restored."
              : "Через 30 дней удалятся сохранённые даты, пары и разборы. До этого аккаунт можно восстановить."}</p>
          </div>
          <Link className="btn ghost sm" href="/account/delete" data-testid="profile-delete-account">{en ? "Delete" : "Удалить"}</Link>
        </div>
      </div>}
    </section>
  );
}
