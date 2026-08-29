"use client";

// Единственный источник признака доступа — ответ сервера (`GET /api/auth/me` через BFF).
// localStorage держит только подсказку «права скорее всего есть», чтобы не мигать замками
// в ожидании ответа; открыть разделы она не может.
import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api";
import { needsReload, ownerChanged, sessionAppeared } from "@/lib/session";
import { cachePaid, cachedPaid, clearBirth, forgetSession } from "@/lib/storage";

export type SessionStatus = "loading" | "guest" | "user" | "offline";

export interface Session {
  status: SessionStatus;
  email: string | null;
  /** виды доступа, подтверждённые сервером: single | matrix | all */
  scopes: string[];
  /** есть хоть одно действующее право */
  paid: boolean;
  /** право хранить больше одной матрицы */
  canStore: boolean;
  /** право открывать любые даты */
  unlimited: boolean;
  /** до какого числа действует срочное право; null — бессрочно или прав нет */
  until: string | null;
  used: number;
  /** сколько дат можно держать: null — без ограничения */
  limit: number | null;
  /** сколько дат куплено бессрочно */
  owned: number;
  /** доступна ли админка */
  admin: boolean;
  /** подсказка из кеша браузера: доступ не даёт, только объясняет ожидание */
  cached: boolean;
  error: string | null;
}

const EMPTY: Session = {
  status: "loading",
  email: null,
  scopes: [],
  paid: false,
  canStore: false,
  unlimited: false,
  until: null,
  used: 0,
  limit: 1,
  owned: 0,
  admin: false,
  cached: false,
  error: null,
};

let snapshot: Session = EMPTY;
let inflight: Promise<Session> | null = null;
const listeners = new Set<(s: Session) => void>();

function publish(next: Session): Session {
  snapshot = next;
  for (const listener of listeners) listener(next);
  return next;
}

export function refreshSession(): Promise<Session> {
  if (inflight) return inflight;
  publish({ ...snapshot, status: "loading", cached: cachedPaid(), error: null });
  const before = snapshot.email;
  inflight = api
    .me()
    .then((me) => {
      const paid = me.scopes.length > 0;
      cachePaid(paid);
      // Вошли другим человеком в этой же вкладке: его кабинет не должен предлагать сохранить
      // дату рождения предыдущего, а «Мой разбор» — строиться по ней.
      if (ownerChanged(before, me.user?.email ?? null)) {
        clearBirth();
        announce();
      }
      return publish({
        status: "user",
        email: me.user?.email ?? null,
        scopes: me.scopes,
        paid,
        canStore: me.can_store,
        unlimited: me.unlimited,
        until: me.until,
        used: me.matrices_used,
        limit: me.matrices_limit,
        owned: me.owned,
        admin: me.is_admin,
        cached: paid,
        error: null,
      });
    })
    .catch((err) => {
      if (err instanceof ApiError && err.status === 401) {
        forgetSession();
        return publish({ ...EMPTY, status: "guest" });
      }
      // сервер не подтвердил доступ — значит доступа нет; кеш остаётся только текстом объяснения
      return publish({
        ...EMPTY,
        status: "offline",
        cached: cachedPaid(),
        error: err instanceof ApiError ? err.message : "Не удалось проверить доступ.",
      });
    })
    .finally(() => {
      inflight = null;
      checkedAt = Date.now();
    });
  return inflight;
}

const CHANNEL = "arcana-session";
// Своё сообщение приходит и в эту же вкладку: BroadcastChannel не доставляет только тому же
// объекту канала, а их здесь два. Из-за этого вход другим человеком перезагружал страницу
// входа раньше перехода в кабинет, а «Выйти» перезагружало текущий адрес вместо главной.
const TAB = Math.random().toString(36).slice(2);
const RECHECK_AFTER_MS = 2000;
let checkedAt = 0;
let watching = false;

function announce(): void {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ from: TAB });
    channel.close();
  } catch {
    /* старый браузер — остальные вкладки узнают о смене при возврате к ним */
  }
}

/**
 * Общий компьютер: в одной вкладке вышли и вошли другим человеком, а вторая осталась открытой и
 * продолжала показывать почту, матрицы и дату рождения предыдущего. Поэтому вкладка перечитывает
 * сессию при возврате к ней и перезагружается, если хозяин сессии сменился.
 */
function watchTabs(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;

  const recheck = () => {
    if (document.visibilityState === "hidden") return;
    const now = Date.now();
    if (now - checkedAt < RECHECK_AFTER_MS) return;
    checkedAt = now;
    const shown = snapshot.email;
    const shownStatus = snapshot.status;
    void refreshSession().then((next) => {
      // «сервер не ответил» — не «пришёл другой человек»: секундный отказ /auth/me при возврате
      // во вкладку стирал дату рождения и перезагружал страницу
      if (next.status === "loading" || next.status === "offline") return;
      if (needsReload(shown, next.email)) {
        clearBirth();
        window.location.reload();
        return;
      }
      // Сессия появилась, пока вкладка стояла в стороне (вошли или оплатили в соседней):
      // серверная часть страницы осталась гостевой, и оплаченный разбор показывался закрытым.
      // На странице чека не перезагружаемся — там сверка идёт по расписанию и раньше уводила
      // в бесконечный круг.
      if (
        sessionAppeared(shownStatus, shown, next.email) &&
        next.status === "user" &&
        !window.location.search.includes("paid=")
      ) {
        window.location.reload();
      }
    });
  };

  document.addEventListener("visibilitychange", recheck);
  window.addEventListener("focus", recheck);
  window.addEventListener("pageshow", recheck);
  try {
    const channel = new BroadcastChannel(CHANNEL);
    // Дата рождения лежит в хранилище вкладки, поэтому выход в соседней её не убирал: на общем
    // компьютере её видел следующий человек.
    channel.onmessage = (event: MessageEvent) => {
      if ((event.data as { from?: string } | null)?.from === TAB) return;
      clearBirth();
      window.location.reload();
    };
  } catch {
    /* см. announce */
  }
}

/** Выход. Возвращает false, когда сервер не подтвердил: кука httpOnly жива, и молча
 *  показывать «вы вышли» нельзя — на общем компьютере это чужой доступ. */
export async function signOutSession(): Promise<boolean> {
  try {
    await api.logout();
  } catch {
    // куку гасит только сервер: локальная чистка выходом не является
    return false;
  }
  forgetSession();
  // Дата рождения из калькулятора живёт в браузере и после выхода оставалась на «Мой разбор»:
  // на общем компьютере её видел следующий человек.
  clearBirth();
  publish({ ...EMPTY, status: "guest" });
  announce();
  return true;
}

export function useSession(): Session & {
  refresh: () => Promise<Session>;
  signOut: () => Promise<boolean>;
} {
  const [state, setState] = useState<Session>(snapshot);

  useEffect(() => {
    listeners.add(setState);
    setState(snapshot);
    watchTabs();
    if (snapshot.status === "loading" && !inflight) void refreshSession();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return { ...state, refresh: refreshSession, signOut: signOutSession };
}
