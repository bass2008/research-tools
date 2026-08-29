"use client";

import { useHydrated } from "@/lib/hydrated";
import Link from "next/link";
import { useEffect, useState } from "react";

import { track } from "@/lib/analytics";
import { ApiError, api } from "@/lib/api";
import { clearLead, loadLead, saveLead } from "@/lib/storage";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * Сбор почты без оплаты: раньше лид собирался только внутри формы платежа, то есть от людей,
 * которые уже решились платить. Отказ сети почту не теряет — она лежит в браузере и уходит
 * при следующем открытии страницы, поэтому текст ответа честный, а не «спасибо, отправлено».
 */
export default function LeadForm({ source = "landing" }: { source?: string }) {
  const [email, setEmail] = useState("");
  // отказ и приём почты выводились одним приглушённым серым: непринятый адрес выглядел как
  // принятый, отличить можно было только прочитав текст
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // почта уходит на сервер и хранится: без явного согласия и ссылки на политику это сбор
  // персональных данных без основания
  const [agreed, setAgreed] = useState(false);
  const hydrated = useHydrated();

  useEffect(() => {
    const kept = loadLead();
    if (!kept) return;
    api
      .lead(kept.email, kept.tariff ? `pay:${kept.tariff}` : source)
      .then(() => clearLead())
      .catch(() => {
        /* сеть всё ещё лежит — почта остаётся в браузере до следующего раза */
      });
  }, [source]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(mail)) {
      setStatus({ ok: false, text: "Проверьте адрес почты: нужен вид you@mail.ru." });
      return;
    }
    if (!agreed) {
      setStatus({ ok: false, text: "Нужно согласие на обработку почты." });
      return;
    }
    setBusy(true);
    setStatus(null);
    track("lead", { place: source });
    try {
      await api.lead(mail, source);
      clearLead();
      setStatus({
        ok: true,
        text: "Спасибо, почту приняли. Напишем, когда выйдут новые разделы разбора.",
      });
    } catch (err) {
      saveLead({ email: mail, at: Date.now() });
      setStatus({
        ok: false,
        text:
          err instanceof ApiError && err.status === 400
            ? `${err.message}. Проверьте адрес и попробуйте ещё раз.`
            : "Не удалось отправить почту: сервер не ответил. Сохранили её в этом браузере — " +
              "отправим сами при следующем заходе.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form method="post" className="panel narrow" data-role="lead" onSubmit={submit} style={{ textAlign: "left" }}>
      <h3>Новые разделы разбора — на почту</h3>
      <div className="cap">Письма редкие, только о разборе; отписка одной ссылкой</div>
      <label htmlFor="leademail">Почта</label>
      <input
        disabled={!hydrated}
        id="leademail"
        data-testid="lead-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => {
          setStatus(null);
          setEmail(e.target.value);
        }}
        placeholder="you@mail.ru"
      />
      <label className="consent" style={{ marginTop: 10 }}>
        <input
          type="checkbox"
          disabled={!hydrated}
          checked={agreed}
          onChange={(e) => {
            setStatus(null);
            setAgreed(e.target.checked);
          }}
        />
        <span>
          Согласен(на) получать письма о новых разделах разбора и на обработку почты по{" "}
          <Link href="/privacy" target="_blank" rel="noopener">
            политике обработки персональных данных
          </Link>
          . Отписка — ссылкой в любом письме.
        </span>
      </label>
      <button className="btn wide" data-testid="lead-submit" style={{ marginTop: 12 }} disabled={busy || !hydrated}>
        {!hydrated ? "Готовим форму…" : busy ? "Отправляем…" : "Оставить почту"}
      </button>
      <p
        className={status && !status.ok ? "hint err" : "hint"}
        data-testid="lead-status"
        role="status"
        aria-live="polite"
      >
        {status?.text ?? ""}
      </p>
      <p className="small" style={{ marginBottom: 0 }}>
        Дата рождения в письмах не участвует: она остаётся в браузере.
      </p>
    </form>
  );
}
