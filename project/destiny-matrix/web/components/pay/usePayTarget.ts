"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import type { MatrixListItem } from "@/lib/api";
import {
  forLocale as targetsForLocale, targetValue,
  type Target,
  type TargetOption,
  type TargetRow
} from "@/lib/paytarget";
import type { StoredBirth } from "@/lib/storage";
import { useMemo, useState } from "react";

/**
 * Какую дату откроет платёж.
 *
 * Не состояние экрана, а вывод из четырёх входов: сохранённые даты, дата в браузере, номер в
 * адресе `?m=` и выбор человека. Пока это считалось эффектом с четырьмя ранними выходами,
 * оттуда вышли три бага подряд: платёж уходил за чужую дату, за уже открытую и за
 * несуществующую. Вывод чистый, состояние здесь одно — «человек выбрал сам».
 */
export interface PayTarget {
  target: Target;
  /** варианты для списка; пусто, пока сохранённые даты не пришли */
  choices: TargetOption[];
  label: string | null;
  /** запись, которую просили открыть, уже открыта — платить второй раз нечего */
  opened: TargetRow | null;
  /** ссылка из кабинета, а человек не вошёл: подменять дату нельзя, нужно объяснить */
  needsLogin: boolean;
  /** номер в адресе есть, но такой записи у человека нет */
  missing: boolean;
  choose: (value: string) => void;
}

export function usePayTarget({
  saved,
  birth,
  wanted,
  guest,
}: {
  /** null — список ещё не пришёл: цель считать рано */
  saved: MatrixListItem[] | null;
  birth: StoredBirth | null;
  wanted: number | null;
  guest: boolean;
}): PayTarget {
  const locale = useLocale();
  const { alreadyOpen, askedOpen, options: targetOptions, pickTarget, stillValid, targetLabel } = targetsForLocale(locale);
  // выбор руками: с этого момента адрес его не перебивает
  const [chosen, setChosen] = useState<string | null>(null);

  return useMemo(() => {
    const rows = saved ?? [];
    const choices = saved === null ? [] : targetOptions(rows, birth);
    const askedDone = askedOpen(rows, wanted);
    const opened = askedDone ?? alreadyOpen(rows, birth);
    const needsLogin = wanted !== null && guest;

    const byHand = chosen === null ? null : choices.find((o) => o.value === chosen)?.target ?? null;
    const auto = (() => {
      if (saved === null) return null;
      // ссылка обещает конкретную дату: открыть её нельзя без входа и незачем, если она открыта
      if (needsLogin || askedDone) return null;
      return pickTarget(rows, birth, wanted);
    })();

    const target = byHand && stillValid(byHand, choices) ? byHand : auto;
    const missing = wanted !== null && !needsLogin && !askedDone && target === null;

    return {
      target,
      choices,
      label: targetLabel(target, rows, birth),
      opened,
      needsLogin,
      missing,
      choose: (value: string) => setChosen(value),
    };
  }, [saved, birth, wanted, guest, chosen, locale]);
}

export { targetValue };
