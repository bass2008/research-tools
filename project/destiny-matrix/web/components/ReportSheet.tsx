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
}: {
  matrix: Matrix;
  sections: SectionOut[];
  planName: string;
  saved: SavedMatrix[];
  currentId: number;
}) {
  const open = sections.filter((s) => s.positions.length).length;
  const locked = sections.filter((s) => !s.positions.length);

  return (
    <>
      <p className="crumbs">
        <Link href="/">Главная</Link> <span>/</span> <Link href="/account">Кабинет</Link>{" "}
        <span>/</span> <span>Мой разбор</span>
      </p>
      <h1>Разбор матрицы судьбы</h1>
      <div className="rsub">
        <p className="dim">
          {birthLabel(matrix.birth)} · {matrix.sex === "f" ? "женская карта" : "мужская карта"} · тариф
          «{planName}» — открыто {open} из {sections.length} разделов
        </p>
        <span className="rsubact">
          <SavePdfButton />
          <MatrixSwitch saved={saved} currentId={currentId} />
        </span>
      </div>

      <div className="section-gap">
        <MatrixResult m={matrix} />
      </div>

      <ReportSections sections={sections} />

      {locked.length ? (
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
          <UnlockCta place="report_upgrade">
            Купить
          </UnlockCta>
        </div>
      ) : null}


      <p className="small section-gap">
        <Link href="/account">Кабинет</Link> · <Link href="/#calc">Новый расчёт</Link>
      </p>
    </>
  );
}
