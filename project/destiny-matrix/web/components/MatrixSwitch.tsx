"use client";

import { useRouter } from "next/navigation";

import { birthLabel } from "./MatrixResult";
import type { SavedMatrix } from "./ReportSheet";

/**
 * Переключатель матриц в строке подписи разбора. Список внизу страницы был не к месту: выбор
 * дат — это свойство открытой страницы, а не ещё один её раздел. Показывается только когда
 * матриц больше одной: с единственной переключать нечего.
 *
 * В подписи стоит имя матрицы, а если его нет — дата. Одно и то же правило в кабинете и здесь,
 * чтобы подписанная матрица узнавалась везде.
 */
export default function MatrixSwitch({
  saved,
  currentId,
}: {
  saved: SavedMatrix[];
  currentId: number;
}) {
  const router = useRouter();
  if (saved.length < 2) return null;

  return (
    <label className="matswitch">
      <span className="cap">Матрица</span>
      <select
        data-testid="matrix-switch"
        value={currentId}
        onChange={(e) => router.push(`/matrices/${e.target.value}`)}
      >
        {saved.map((it) => (
          <option key={it.id} value={it.id}>
            {it.title ?? birthLabel(it.birth)}
          </option>
        ))}
      </select>
    </label>
  );
}
