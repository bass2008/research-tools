// Разбор, напечатанный сервером: сюда попадают толкования платных разделов, поэтому компонент
// серверный и вызывается только после того, как кука подтвердила тариф.
import Link from "next/link";

import type { Matrix } from "@/lib/matrix";
import LocalMatrixNote from "./LocalMatrixNote";
import LockIcon from "./LockIcon";
import MatrixResult, { birthLabel } from "./MatrixResult";
import Price from "./Price";
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
      <p className="dim">
        {birthLabel(matrix.birth)} · {matrix.sex === "f" ? "женская карта" : "мужская карта"} · тариф
        «{planName}» — открыто {open} из {sections.length} разделов
      </p>

      <div className="section-gap">
        <MatrixResult m={matrix} />
      </div>

      <ReportSections sections={sections} />

      {locked.length ? (
        <div className="allbox">
          <h3>Ещё {locked.length} разделов в полном разборе</h3>
          <p>
            Ваш тариф открывает часть платных разделов. Полный разбор добавляет остальные — один платёж,
            без подписки.
          </p>
          <div className="alllist">
            {locked.map((s) => (
              <span key={s.key}>
                  <LockIcon /> {s.title}
                </span>
            ))}
          </div>
          <UnlockCta place="report_upgrade">
            Открыть все за <Price />
          </UnlockCta>
        </div>
      ) : null}

      <LocalMatrixNote shown={matrix.birth} />

      {saved.length > 1 ? (
        <div className="panel section-gap">
          <h3>Ваши матрицы</h3>
          <div className="cap">Разбор печатается по выбранной — переключите, чтобы открыть другую</div>
          <div className="taglist">
            {saved.map((it) => (
              <Link
                key={it.id}
                href={`/matrices/${it.id}`}
                data-testid={it.id === currentId ? "matrix-current" : undefined}
              >
                {it.title ?? birthLabel(it.birth)}
                {it.id === currentId ? " · открыт" : ""}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <p className="small section-gap">
        Разделы печатает сервер при каждом открытии страницы: в HTML для неоплатившего их нет, а
        в браузере они не хранятся. <Link href="/account">Кабинет</Link> ·{" "}
        <Link href="/#calc">Новый расчёт</Link>
      </p>
    </>
  );
}
