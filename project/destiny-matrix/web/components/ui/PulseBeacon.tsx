"use client";

/**
 * Отметка присутствия: раз в 45 секунд говорим серверу «я здесь». Нужна, чтобы админка знала,
 * сколько человек на сайте сейчас, — Метрика этого не покажет вовремя и считает роботов людьми.
 * Идентификатор посетителя анонимный и общий для вкладок одного браузера; идентификатор вкладки
 * отдельный. Иначе пять открытых страниц выглядели в админке как пять разных людей.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const VISITOR_KEY = "destiny.visitor";
const TAB_KEY = "destiny.tab";
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
    const kept = localStorage.getItem(VISITOR_KEY);
    if (kept) return kept;
    // До разделения людей и вкладок visitor лежал в sessionStorage. Первая обновившаяся вкладка
    // переносит прежнее значение в общее хранилище, остальные начинают использовать его же.
    const legacy = sessionStorage.getItem(VISITOR_KEY);
    const visitor = legacy || fresh;
    localStorage.setItem(VISITOR_KEY, visitor);
    sessionStorage.removeItem(VISITOR_KEY);
    return visitor;
  } catch {
    /* приватный режим без localStorage — остаётся анонимный запасной идентификатор документа */
  }
  return fresh;
}

function tabId(): string {
  const fresh = newId();
  try {
    const kept = sessionStorage.getItem(TAB_KEY);
    if (kept) return kept;
    sessionStorage.setItem(TAB_KEY, fresh);
  } catch {
    /* хранилище недоступно — вкладка всё равно получит идентификатор до следующего рендера */
  }
  return fresh;
}

export default function PulseBeacon() {
  const path = usePathname();

  useEffect(() => {
    // страницу печати открывает наш же Chromium: это не посетитель, считать его нельзя
    if (path.startsWith("/print")) return;
    const visitor = visitorId();
    const tab = tabId();
    const beat = () => {
      void fetch("/api/pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor, tab, path }),
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
