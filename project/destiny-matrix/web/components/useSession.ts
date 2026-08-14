"use client";

// Единственный источник признака доступа — ответ сервера (`GET /api/auth/me` через BFF).
// localStorage держит только подсказку «права скорее всего есть», чтобы не мигать замками
// в ожидании ответа; открыть разделы она не может.
import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api";
import { cachePaid, cachedPaid, forgetSession } from "@/lib/storage";

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
  inflight = api
    .me()
    .then((me) => {
      const paid = me.scopes.length > 0;
      cachePaid(paid);
      return publish({
        status: "user",
        email: me.user?.email ?? null,
        scopes: me.scopes,
        paid,
        canStore: me.can_store,
        unlimited: me.unlimited,
        until: me.until,
        used: me.matrices_used,
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
    });
  return inflight;
}

export async function signOutSession(): Promise<void> {
  try {
    await api.logout();
  } catch {
    /* куку гасит сервер; если он не ответил, локальный кеш всё равно чистим */
  }
  forgetSession();
  publish({ ...EMPTY, status: "guest" });
}

export function useSession(): Session & {
  refresh: () => Promise<Session>;
  signOut: () => Promise<void>;
} {
  const [state, setState] = useState<Session>(snapshot);

  useEffect(() => {
    listeners.add(setState);
    setState(snapshot);
    if (snapshot.status === "loading" && !inflight) void refreshSession();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return { ...state, refresh: refreshSession, signOut: signOutSession };
}
