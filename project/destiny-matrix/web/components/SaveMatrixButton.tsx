"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, api } from "@/lib/api";
import type { Sex } from "@/lib/matrix";

import { birthLabel } from "./MatrixResult";

/**
 * Сохранить матрицу из браузера в кабинет и открыть по ней полный разбор.
 *
 * Дата рождения уходит на сервер только этой кнопкой — потому что платные разделы печатает
 * сервер: в браузер их толкования не приходят вовсе. Отказ «слоты кончились» показывается
 * отдельным крючком `limit-message`: раньше 402 оседал в безымянном блоке ошибки, и человек
 * видел «что-то не так» вместо причины.
 */
export default function SaveMatrixButton({
  birth,
  sex,
  label = "Сохранить матрицу в кабинет",
  done = "Сохранено в кабинете",
  openReport = true,
  onSaved,
}: {
  birth: string;
  sex: Sex;
  label?: string;
  done?: string;
  openReport?: boolean;
  onSaved?: (id: number) => void | Promise<void>;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [limit, setLimit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setState("busy");
    setLimit(null);
    setError(null);
    try {
      const saved = await api.saveMatrix(birth, sex);
      setState("done");
      await onSaved?.(saved.id);
      if (openReport) router.push(`/report?m=${saved.id}`);
      router.refresh();
    } catch (err) {
      setState("idle");
      if (err instanceof ApiError && err.status === 402) {
        // без даты в тексте: она специальная категория ПД и в сообщения не попадает
        setLimit(`${err.message} Уже сохранённые даты остаются в кабинете.`);
        return;
      }
      setError(
        err instanceof ApiError && err.status === 401
          ? "Нужен вход: сохранить матрицу можно только в свой кабинет."
          : err instanceof ApiError
            ? err.message
            : "Не получилось сохранить матрицу.",
      );
    }
  };

  return (
    <div>
      <button
        className="btn sm"
        data-testid="save-matrix"
        onClick={save}
        disabled={state !== "idle"}
        title={`Матрица на ${birthLabel(birth)}`}
      >
        {state === "done" ? done : state === "busy" ? "Сохраняем…" : label}
      </button>
      {limit ? (
        <div className="err" data-testid="limit-message" role="status">
          {limit}
        </div>
      ) : null}
      {error ? <div className="err">{error}</div> : null}
    </div>
  );
}
