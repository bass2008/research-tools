"use client";
import { useEffect, useState } from "react";
import { forLocale as localizedMatrixResult } from "@/components/matrix/MatrixResult";
import { PdfIcon } from "@/components/matrix/SavePdfButton";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ApiError, forLocale } from "@/lib/api";
import { D } from "@/lib/i18n";
import { individualDates, individualKind, type IndividualReading } from "@/lib/individualReading";

export default function IndividualSaveBar({ row, compact = false }: { row: IndividualReading; compact?: boolean }) {
  const L = useLocale(), en = L === "en";
  const { birthLabel } = localizedMatrixResult(L);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => setReady(true), []);
  const pdf = async () => {
    if (busy) return;
    setBusy(true); setNote("");
    try {
      const { url } = await forLocale(L).api.individualPdf(row.id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setNote(err instanceof ApiError ? err.messageFor(L) : D.report.pdfFailed[L]);
    } finally {
      setBusy(false);
    }
  };
  const actions = row.can_pdf && <div className="individual-save-actions">
    <button type="button" className={busy ? "btn ghost sm pdfbtn working" : "btn ghost sm pdfbtn"}
      data-testid="save-pdf" onClick={() => void pdf()} disabled={!ready || busy} aria-busy={busy}>
      <PdfIcon />{busy ? D.report.pdfPreparing[L] : D.report.savePdf[L]}
    </button>
    {note && <span className="err" role="status" data-testid="pdf-error">{note}</span>}
  </div>;
  if (compact) return actions ? <section className="ir-pdf" data-testid="individual-save">{actions}</section> : null;
  return <section className="save-reading-summary" data-testid="individual-save">
    <div><h2>{en ? "Individual reading" : "Индивидуальный разбор"} · {individualDates(row, birthLabel)}</h2>
      <p>{individualKind(row, L)}</p></div>
    {actions}
  </section>;
}
