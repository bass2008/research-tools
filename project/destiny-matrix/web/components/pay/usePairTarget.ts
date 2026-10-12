"use client";

import { pairTitle } from "@/lib/pair/title";
import { useLocale } from "@/components/ui/LocaleProvider";
import { forLocale as localizedApi, type ReadingItem } from "@/lib/api";
import type { StoredPair } from "@/lib/storage";
import { usePair } from "@/lib/usePair";
import { useEffect, useMemo, useState } from "react";

export type PairAim = { readingId: number } | { inputs: StoredPair };

export interface PairTarget {
  /** список сохранённых пар ещё не пришёл */
  loading: boolean;
  aim: PairAim | null;
  value: string;
  label: string | null;
  options: Array<{ value: string; label: string }>;
  /** пару из ссылки уже открыли — платить второй раз нечего */
  opened: ReadingItem | null;
  /** номер в адресе есть, а такой пары у человека нет */
  missing: boolean;
  choose: (value: string) => void;
  /** сохранённые пары: по ним видно, открыта ли уже введённая пара */
  rows: ReadingItem[];
  /** даты, с которых начинается форма: пара из ссылки, из кабинета или из калькулятора */
  initial: StoredPair | null;
}

const keyOf = (pair: StoredPair) => [pair.a.birth, pair.b.birth].sort().join("|");

/** Какую пару откроет платёж: сохранённая в кабинете, пара из браузера или ничего. */
export function usePairTarget({ enabled, signedIn, wanted }: {
  enabled: boolean; signedIn: boolean | null; wanted: number | null;
}): PairTarget {
  const L = useLocale();
  const local = usePair();
  const [saved, setSaved] = useState<ReadingItem[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || signedIn === null) return;
    if (!signedIn) {
      setSaved([]);
      return;
    }
    localizedApi(L).api.readings("pair").then((res) => setSaved(res.items)).catch(() => setSaved([]));
  }, [enabled, signedIn, L]);

  return useMemo(() => {
    const rows = saved ?? [];
    const name = (pair: StoredPair) => pairTitle(L, pair.a, pair.b);
    const savedPair = (row: ReadingItem) => row.inputs as unknown as StoredPair;
    const localSaved = local ? rows.find((row) => keyOf(savedPair(row)) === keyOf(local)) : undefined;
    const options: Array<{ value: string; label: string; aim: PairAim }> = [];
    if (local && !localSaved) options.push({ value: "local", label: name(local), aim: { inputs: local } });
    for (const row of rows.filter((r) => r.access === "locked")) {
      options.push({ value: String(row.id), label: row.title ?? name(savedPair(row)), aim: { readingId: row.id } });
    }
    const asked = wanted !== null ? rows.find((row) => row.id === wanted) ?? null : null;
    // Пару могли купить в соседней вкладке: здесь её нет в браузере, а в кабинете она уже открыта.
    // Тогда честный ответ — «уже открыта», а не «посчитайте совместимость».
    const latestOpen = options.length === 0 && wanted === null
      ? rows.find((row) => row.access !== "locked") ?? null : null;
    const opened = asked && asked.access !== "locked" ? asked : latestOpen;
    const auto = wanted !== null
      ? options.find((o) => o.value === String(wanted)) ?? null
      : (localSaved && localSaved.access === "locked" ? options.find((o) => o.value === String(localSaved.id)) : null)
        ?? options[0] ?? null;
    const picked = (chosen !== null ? options.find((o) => o.value === chosen) : null) ?? auto;
    return {
      loading: enabled && saved === null,
      aim: picked?.aim ?? null,
      value: picked?.value ?? "none",
      label: picked?.label ?? null,
      options: options.map(({ value, label }) => ({ value, label })),
      opened,
      missing: wanted !== null && saved !== null && !asked,
      choose: setChosen,
      rows,
      // уже открытая пара тоже встаёт в поля: форма скажет, что платить незачем, вместо примера
      initial: (() => {
        if (!picked) return asked ? savedPair(asked) : local;
        const aim = picked.aim;
        if ("inputs" in aim) return aim.inputs;
        const row = rows.find((r) => r.id === aim.readingId);
        return row ? savedPair(row) : null;
      })(),
    };
  }, [L, local, saved, chosen, wanted, enabled]);
}
