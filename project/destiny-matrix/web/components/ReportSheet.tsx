// Разбор, напечатанный сервером: сюда попадают толкования платных разделов, поэтому компонент
// серверный и вызывается только после того, как кука подтвердила тариф.
import Link from "next/link";

import type { Matrix } from "@/lib/matrix";
import LockIcon from "./LockIcon";
import MatrixSwitch from "./MatrixSwitch";
import SavePdfButton from "./SavePdfButton";
import MatrixResult, { birthLabel } from "./MatrixResult";
import ReportSections from "./ReportSections";
import UnlockCta from "./UnlockCta";
import type { SectionOut } from "./publicSpec";

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
  saved,
  currentId,
  printing = false,
}: {
  matrix: Matrix;
  sections: SectionOut[];
  planName: string;
  saved: SavedMatrix[];
  currentId: number;
  /** страница печатается в PDF: кнопки и переключатели в файл не нужны */
  printing?: boolean;
}) {
  const open = sections.filter((s) => s.positions.length).length;
  const locked = sections.filter((s) => !s.positions.length);

  return (
    <>
      {printing ? null : (
        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <Link href="/account">Кабинет</Link>{" "}
          <span>/</span> <span>Мой разбор</span>
        </p>
      )}
      <h1>Разбор матрицы судьбы</h1>
      <div className="rsub">
        <p className="dim">
          {birthLabel(matrix.birth)} · {matrix.sex === "f" ? "женская карта" : "мужская карта"} · тариф
          «{planName}» — открыто {open} из {sections.length} разделов
        </p>
        {printing ? null : (
          <span className="rsubact">
            <SavePdfButton matrixId={currentId} />
            <MatrixSwitch saved={saved} currentId={currentId} />
          </span>
        )}
      </div>

      <div className="section-gap">
        <MatrixResult m={matrix} printing={printing} />
      </div>

      <ReportSections sections={sections} matrixId={currentId} printing={printing} />

      {locked.length && !printing ? (
        <div className="allbox">
          <h3>Ещё {locked.length} разделов в полном разборе</h3>
          <p>
            Ваш тариф открывает часть платных разделов. Полный разбор добавляет остальные — одним
            платежом.
          </p>
          <div className="alllist">
            {locked.map((s) => (
              <span key={s.key}>
                  <LockIcon /> {s.title}
                </span>
            ))}
          </div>
          <UnlockCta place="report_upgrade" matrixId={currentId}>
            Купить
          </UnlockCta>
        </div>
      ) : null}


      {printing ? (
        <p className="small section-gap dim">Arcana Sense · arcana-sense.ru</p>
      ) : (
        <p className="small section-gap">
          <Link href="/account">Кабинет</Link> · <Link href="/#calc">Новый расчёт</Link>
        </p>
      )}
    </>
  );
}
