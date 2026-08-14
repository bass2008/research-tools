"use client";

import { useEffect, useState } from "react";

import type { Sex } from "@/lib/matrix";
import { loadBirth } from "@/lib/storage";

import { birthLabel } from "./MatrixResult";
import SaveMatrixButton from "./SaveMatrixButton";

/**
 * В браузере посчитана другая дата, чем та, по которой сервер напечатал разбор. Молча
 * подменять одну на другую нельзя — дата рождения уходит на сервер только по действию
 * человека, поэтому здесь предложение, а не автосохранение.
 */
export default function LocalMatrixNote({ shown }: { shown: string }) {
  const [local, setLocal] = useState<{ birth: string; sex: Sex } | null>(null);

  useEffect(() => {
    const stored = loadBirth();
    setLocal(stored && stored.birth !== shown ? stored : null);
  }, [shown]);

  if (!local) return null;

  return (
    <div className="panel section-gap">
      <h3>В этом браузере открыта другая дата</h3>
      <div className="cap">{birthLabel(local.birth)} — расчёт по ней сделан на месте, на сервер не уходил</div>
      <p className="small">
        Полный разбор печатает сервер, поэтому по этой дате он появится после сохранения матрицы в
        кабинет.
      </p>
      <SaveMatrixButton
        birth={local.birth}
        sex={local.sex}
        label={`Открыть полный разбор на ${birthLabel(local.birth)}`}
      />
    </div>
  );
}
