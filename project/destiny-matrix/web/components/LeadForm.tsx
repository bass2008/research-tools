"use client";

import { useHydrated } from "@/lib/hydrated";
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
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
      setStatus("Проверьте адрес почты: нужен вид you@mail.ru.");
      return;
    }
    setBusy(true);
    setStatus(null);
    track("lead", { place: source });
    try {
      await api.lead(mail, source);
      clearLead();
      setStatus("Спасибо, почту приняли. Напишем, когда выйдут новые разделы разбора.");
    } catch (err) {
      saveLead({ email: mail, at: Date.now() });
      setStatus(
        err instanceof ApiError && err.status === 400
          ? `${err.message}. Проверьте адрес и попробуйте ещё раз.`
          : "Не удалось отправить почту: сервер не ответил. Сохранили её в этом браузере — " +
              "отправим сами при следующем заходе.",
      );
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
        id="leademail"
        data-testid="lead-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@mail.ru"
      />
      <button className="btn wide" data-testid="lead-submit" style={{ marginTop: 12 }} disabled={busy || !hydrated}>
        {busy ? "Отправляем…" : "Оставить почту"}
      </button>
      <p className="hint" data-testid="lead-status" role="status" aria-live="polite">
        {status ?? ""}
      </p>
      <p className="small" style={{ marginBottom: 0 }}>
        Дата рождения в письмах не участвует: она остаётся в браузере.
      </p>
    </form>
  );
}
