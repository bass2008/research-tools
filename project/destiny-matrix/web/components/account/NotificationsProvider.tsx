"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { forLocale, type NotificationPage } from "@/lib/api";
import { useLocale } from "@/components/ui/LocaleProvider";
import { useSession } from "./useSession";

interface InboxState {
  data: NotificationPage | null;
  error: unknown;
  loading: boolean;
  refresh: () => Promise<void>;
}

const InboxContext = createContext<InboxState | null>(null);

export function notificationsChanged() {
  window.dispatchEvent(new Event("notifications-changed"));
}

/** One first page supplies the header badge, cabinet badge and default notification list. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const L = useLocale();
  const session = useSession();
  const [data, setData] = useState<NotificationPage | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++request.current;
    if (session.status !== "user") return;
    setLoading(true);
    try {
      const result = await forLocale(L).api.notifications();
      if (id === request.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === request.current) setError(e);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [L, session.status, session.email]);

  useEffect(() => {
    if (session.status !== "user") {
      if (session.status !== "loading") setData(null);
      return;
    }
    void refresh();
    const reload = () => { void refresh(); };
    // No polling: a returning tab is the moment a new notice can be expected.
    const visible = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("notifications-changed", reload);
    document.addEventListener("visibilitychange", visible);
    return () => {
      request.current++;
      window.removeEventListener("notifications-changed", reload);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh, session.status]);

  return <InboxContext.Provider value={{ data, error, loading, refresh }}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  const inbox = useContext(InboxContext);
  if (!inbox) throw new Error("NotificationsProvider is required");
  return inbox;
}

export function useUnreadCount() {
  return useInbox().data?.unread_count ?? 0;
}
