"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useSession } from "@/components/account/useSession";
import { api, type MatrixListItem } from "@/lib/api";
import {
  BIRTH_EVENT,
  takeCalculationRequest,
  type StoredBirth,
} from "@/lib/storage";

const OwnDates = createContext<MatrixListItem[]>([]);

export function useOwnDates(): MatrixListItem[] {
  return useContext(OwnDates);
}

/**
 * Единое состояние калькулятора на главной: список дат нужен и бесплатному результату, и
 * навигации после «Рассчитать». В двух независимых эффектах запросы расходились по времени:
 * один уже видел покупку, пока второй ещё показывал замки.
 */
export default function CalculationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const [ownDates, setOwnDates] = useState<MatrixListItem[]>([]);
  const [datesReady, setDatesReady] = useState(false);
  const [requested, setRequested] = useState<StoredBirth | null>(null);

  useEffect(() => {
    const pending = takeCalculationRequest();
    if (pending) setRequested(pending);

    const onCalculation = (event: Event) => {
      // Запрос доставлен текущей странице — следующему обычному визиту он уже не принадлежит.
      takeCalculationRequest();
      const value = (event as CustomEvent<StoredBirth | null>).detail;
      setRequested(
        value && typeof value.birth === "string" && (value.sex === "m" || value.sex === "f")
          ? value
          : null,
      );
    };
    window.addEventListener(BIRTH_EVENT, onCalculation);
    return () => window.removeEventListener(BIRTH_EVENT, onCalculation);
  }, []);

  useEffect(() => {
    if (session.status === "loading") {
      setDatesReady(false);
      return;
    }
    if (session.status !== "user") {
      setOwnDates([]);
      setDatesReady(true);
      return;
    }

    let alive = true;
    setDatesReady(false);
    api
      .matrices()
      .then((res) => {
        if (!alive) return;
        setOwnDates(res.items);
        setDatesReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setOwnDates([]);
        setDatesReady(true);
      });
    return () => {
      alive = false;
    };
  }, [session.status]);

  useEffect(() => {
    if (!requested || !datesReady) return;
    // Пол в поиске права не участвует: см. комментарий в `MatrixReport.tsx`.
    const paid = ownDates.find(
      (row) => row.birth === requested.birth && row.access !== "locked",
    );

    if (paid) {
      const target = `/?m=${paid.id}#result`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (current !== target) router.push(target);
    } else if (new URLSearchParams(window.location.search).has("m")) {
      // На главной открыт прежний купленный отчёт, но человек запросил другую дату.
      router.push("/#result");
    }
    setRequested(null);
  }, [datesReady, ownDates, requested, router]);

  return <OwnDates.Provider value={ownDates}>{children}</OwnDates.Provider>;
}
