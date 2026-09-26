"use client";

/**
 * Сохранение разбора в PDF. Печатает сервер, а не диалог браузера: в диалоге поля, масштаб и
 * «печатать ли фоны» задаёт человек, поэтому файл выходил не похожим на страницу. Теперь ту же
 * страницу открывает Chromium с нашими параметрами, PDF ложится в хранилище и живёт там — второе
 * нажатие отдаёт тот же файл, ничего не печатая заново.
 */
import { useLocale } from "@/components/ui/LocaleProvider";
import { track } from "@/lib/analytics";
import { ApiError, forLocale as localizedApi } from "@/lib/api";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { useMessage } from "@/lib/i18n/useMessage";
import { useEffect, useState } from "react";

type State = "idle" | "busy" | "ready" | "failed";

export const forLocale = localized((L: Locale) => {
  const { api } = localizedApi(L);

  return { api };
});

export default function SavePdfButton({ locale: requestedLocale, ...localeProps }: ({
  matrixId: number;
  label?: string;
  /** дата открытого разбора: попадает в подсказку, чтобы было видно, что скачается именно он */
  hint?: string;
}) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const {
    matrixId,
    label = D.report.savePdf[L],
    hint,
  } = localeProps;
  const { api } = forLocale(L);

  // до гидратации обработчик клика не подключён: без этого кнопка выглядела рабочей, а нажатие
  // не делало ничего
  const [ready, setReady] = useState(false);
  const [download, setDownload] = useState<{ locale: Locale; matrixId: number; state: State } | null>(null);
  const state = download?.locale === L && download.matrixId === matrixId ? download.state : "idle";
  const setState = (state: State) => setDownload({ locale: L, matrixId, state });
  const [note, setNote] = useMessage(L);

  useEffect(() => setReady(true), []);

  // Печать начинается сразу после оплаты, поэтому к первому нажатию файл обычно уже готов.
  // Спрашиваем состояние один раз: если готов — кнопка так и говорит и не обещает ожидания.
  const [cached, setCached] = useState<{ locale: Locale; matrixId: number; ready: boolean } | null>(null);
  const warm = cached?.locale === L && cached.matrixId === matrixId && cached.ready;
  useEffect(() => {
    let alive = true;
    api
      .reportJobs()
      .then((res) => {
        if (!alive) return;
        setCached({ locale: L, matrixId,
          ready: res.items.some((job) => job.matrix_id === matrixId && job.locale === L && job.status === "done") });
      })
      .catch(() => {
        /* состояние печати — подсказка, без неё кнопка работает как раньше */
      });
    return () => {
      alive = false;
    };
  }, [matrixId, L]);

  const open = (href: string) => window.open(href, "_blank", "noopener");

  const click = async () => {
    if (state === "busy") return;
    // Ссылку не запоминаем: она подписана на час, и на странице, открытой дольше, хранилище
    // отвечало «Access Denied». Файл уже напечатан, поэтому повторный запрос отдаёт его сразу.
    setState("busy");
    setNote(null);
    track("pdf_click", { place: "report" });
    try {
      const res = await api.reportPdf(matrixId);
      setState("ready");
      open(res.url);
    } catch (err) {
      setState("failed");
      setNote(
        (locale) => err instanceof ApiError
          ? err.messageFor(locale)
          : D.report.pdfFailed[locale],
      );
    }
  };

  return (
    <>
      <button
        type="button"
        className={state === "busy" ? "btn ghost sm pdfbtn working" : "btn ghost sm pdfbtn"}
        data-testid="save-pdf"
        title={hint ? D.report.pdfTitle[L](hint) : undefined}
        aria-label={hint ? D.report.pdfAria[L](hint) : undefined}
        onClick={click}
        disabled={!ready || state === "busy"}
        aria-busy={state === "busy"}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          {/* дискета: корпус, шторка и наклейка */}
          <path
            d="M4 3.5h11.2L20.5 8.8V20a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M7.8 3.5h7.4v5H7.8z" fill="currentColor" />
          <path d="M7 13h10v7.5H7z" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9.4 15.4h5.2M9.4 17.6h3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {state === "busy"
          ? D.report.pdfPreparing[L]
          : state === "ready"
            ? D.report.pdfOpen[L]
            : warm
              ? D.report.pdfDownload[L]
              : label}
      </button>
      {note ? (
        <span className="err" data-testid="pdf-error" role="status">
          {note}
        </span>
      ) : null}
    </>
  );
}
