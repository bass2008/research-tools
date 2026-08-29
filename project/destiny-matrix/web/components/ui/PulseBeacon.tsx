"use client";

/**
 * Отметка присутствия: раз в 45 секунд говорим серверу «я здесь». Нужна, чтобы админка знала,
 * сколько человек на сайте сейчас, — Метрика этого не покажет вовремя и считает роботов людьми.
 * Идентификатор анонимный, живёт во вкладке и ни с чем не связан.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const KEY = "destiny.visitor";
const EVERY = 45_000;

function newId(): string {
  // randomUUID есть только в защищённом контексте: по http (а так печать открывает страницу
  // внутри сети) его нет вовсе, и обращение к нему роняло рендер — PDF выходил пустым.
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* ниже запасной вариант */
  }
  return `v-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function visitorId(): string {
  const fresh = newId();
  try {
    const kept = sessionStorage.getItem(KEY);
    if (kept) return kept;
    sessionStorage.setItem(KEY, fresh);
  } catch {
    /* приватный режим — считаемся новым гостем на каждой вкладке */
  }
  return fresh;
}

export default function PulseBeacon() {
  const path = usePathname();

  useEffect(() => {
    // страницу печати открывает наш же Chromium: это не посетитель, считать его нельзя
    if (path.startsWith("/print")) return;
    const visitor = visitorId();
    const beat = () => {
      void fetch("/api/pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor, path }),
      })
        // тело ответа обязательно вычитать: непрочитанный поток держит соединение открытым, и
        // страница никогда не переходит в состояние «сеть успокоилась»
        .then((answer) => answer.text())
        .catch(() => {
          /* счётчик присутствия — не повод показывать человеку ошибку */
        });
    };
    beat();
    const timer = setInterval(beat, EVERY);
    return () => clearInterval(timer);
  }, [path]);

  return null;
}
