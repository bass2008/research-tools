"use client";

import { forLocale as localizedMatrixResult } from "@/components/matrix/MatrixResult";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ApiError, forLocale as localizedApi } from "@/lib/api";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { useMessage } from "@/lib/i18n/useMessage";
import type { Sex } from "@/lib/matrix";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const forLocale = localized((L: Locale) => {
  const { api } = localizedApi(L);
  const { birthLabel } = localizedMatrixResult(L);

  return { api, birthLabel };
});

/**
 * Сохранить матрицу из браузера в кабинет и открыть по ней полный разбор.
 *
 * Дата рождения уходит на сервер только этой кнопкой — потому что платные разделы печатает
 * сервер: в браузер их толкования не приходят вовсе. Отказ «слоты кончились» показывается
 * отдельным крючком `limit-message`: раньше 402 оседал в безымянном блоке ошибки, и человек
 * видел «что-то не так» вместо причины.
 */
export default function SaveMatrixButton({ locale: requestedLocale, ...localeProps }: ({
  birth: string;
  sex: Sex;
  label?: string;
  done?: string;
  openReport?: boolean;
  onSaved?: (id: number) => void | Promise<void>;
}) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const {
    birth,
    sex,
    label = D.report.saveMatrix[L],
    done = D.report.savedToAccount[L],
    openReport = true,
    onSaved,
  } = localeProps;
  const { api, birthLabel } = forLocale(L);

  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [limit, setLimit] = useMessage(L);
  const [error, setError] = useMessage(L);

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
        setLimit((locale) => `${err.messageFor(locale)} ${D.report.limitTail[locale]}`);
        return;
      }
      setError(
        (locale) => err instanceof ApiError && err.status === 401
          ? D.report.needLogin[locale]
          : err instanceof ApiError
            ? err.messageFor(locale)
            : D.report.saveFailed[locale],
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
        title={D.report.saveTitle[L](birthLabel(birth))}
      >
        {state === "done" ? done : state === "busy" ? D.report.saving[L] : label}
      </button>
      {limit ? (
        <div className="err" data-testid="limit-message" role="status">
          {limit}
        </div>
      ) : null}
      {error ? <div className="err" role="alert" aria-live="assertive">{error}</div> : null}
    </div>
  );
}
