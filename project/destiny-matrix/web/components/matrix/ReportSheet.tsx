// Разбор, напечатанный сервером: сюда попадают толкования платных разделов, поэтому компонент
// серверный и вызывается только после того, как кука подтвердила тариф.
import Link from "next/link";

import { ALL_FREE } from "@/lib/access";
import { D, L } from "@/lib/i18n";
import type { Matrix } from "@/lib/matrix";
import { DISCLAIMER } from "@/lib/site";
import LockIcon from "@/components/ui/LockIcon";
import SavePdfButton from "@/components/matrix/SavePdfButton";
import MatrixResult, { birthLabel } from "@/components/matrix/MatrixResult";
import ReportSections from "@/components/matrix/ReportSections";
import UnlockCta from "@/components/pay/UnlockCta";
import type { SectionOut } from "@/lib/publicSpec";

export interface SavedMatrix {
  id: number;
  birth: string;
  sex: "m" | "f";
  title: string | null;
}

export default function ReportSheet({
  matrix,
  sections,
  planName,
  unlocked,
  saved,
  currentId,
  printing = false,
  embedded = false,
}: {
  matrix: Matrix;
  sections: SectionOut[];
  planName: string;
  /** Доступ к платным разделам подтверждён именно для этой сохранённой матрицы. */
  unlocked: boolean;
  saved: SavedMatrix[];
  currentId: number;
  /** страница печатается в PDF: кнопки и переключатели в файл не нужны */
  printing?: boolean;
  /** Отчёт стоит внутри главной, где h1 и навигационная цепочка уже есть. */
  embedded?: boolean;
}) {
  const open = sections.filter((s) => s.positions.length).length;
  const locked = sections.filter((s) => !s.positions.length);
  const Heading = embedded ? "h2" : "h1";

  return (
    <>
      {printing || embedded ? null : (
        <p className="crumbs">
          <Link href="/">{D.nav.home[L]}</Link> <span>/</span>{" "}
          <Link href="/account">{D.nav.account[L]}</Link> <span>/</span>{" "}
          <span>{D.nav.myReading[L]}</span>
        </p>
      )}
      <Heading>{D.sheet.title[L]}</Heading>
      <div className="rsub">
        <p className="dim">
          {birthLabel(matrix.birth)} ·{" "}
          {matrix.sex === "f" ? D.calc.femaleChartLabel[L] : D.calc.maleChartLabel[L]} ·{" "}
          {/* тариф называем только там, где он есть: без кассы имя тарифа обещает покупку */}
          {!ALL_FREE && unlocked ? D.sheet.planNamed[L](planName) : D.sheet.freeAccess[L]} —{" "}
          {D.sheet.openOf[L](open, sections.length)}
        </p>
        {printing || locked.length ? null : (
          /* кнопка и её сообщение живут в одной ячейке: иначе текст ошибки становился третьим
             элементом строки и сдвигал кнопку от правого края.
             На закрытом разборе кнопки нет вовсе: она была активной и всегда отвечала
             «Разбор этой даты не оплачен» — обещание, которого страница не выполняет */
          <span className="pdfslot">
            <SavePdfButton matrixId={currentId} hint={birthLabel(matrix.birth)} />
          </span>
        )}
      </div>

      <div className="section-gap">
        <MatrixResult m={matrix} printing={printing} />
      </div>

      <ReportSections sections={sections} matrixId={currentId} printing={printing} />

      {locked.length && !printing ? (
        <div className="allbox">
          <h3>{D.sheet.moreInFull[L](locked.length)}</h3>
          <p>{D.sheet.moreInFullText[L]}</p>
          <div className="alllist">
            {locked.map((s) => (
              <span key={s.key}>
                  <LockIcon /> {s.title}
                </span>
            ))}
          </div>
          <UnlockCta place="report_upgrade" matrixId={currentId}>
            {D.nav.buy[L]}
          </UnlockCta>
        </div>
      ) : null}


      {/* Оговорку печатает подвал сайта, а страница печати подвала не выводит: в скачанном PDF
          её не было вовсе, хотя на каждой странице сайта она стоит. Файл уходит наружу и живёт
          отдельно от сайта, поэтому несёт её сам. */}
      {printing ? (
        <p className="small section-gap dim">
          {D.sheet.printedBy[L]}
          <br />
          {DISCLAIMER}
        </p>
      ) : null}
    </>
  );
}
