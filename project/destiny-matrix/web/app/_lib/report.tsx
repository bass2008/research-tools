import Link from "next/link";
import { notFound } from "next/navigation";

import ReportSheet from "@/components/matrix/ReportSheet";
import { calculate } from "@/lib/matrix";
import { build } from "@/lib/sections";
import { getTariffs } from "@/lib/tariffs";

import { planLabel, readMatrixUnlocked, type Access, type SavedMatrix } from "./access";

/**
 * Рамка страницы разбора. Два экрана — свой разбор и сохранённая матрица — отличаются только
 * правилами входа и ссылкой внизу, поэтому сама рамка и тело общие.
 */
export function Sheet({ children, other }: { children: React.ReactNode; other: React.ReactNode }) {
  return (
    <main id="content" className="page">
      <div className="wrap">
        {children}
        <p className="small center" style={{ marginTop: 18 }}>
          <Link href="/account">Кабинет</Link> · <Link href="/#calc">Новый расчёт</Link> · {other}
        </p>
      </div>
    </main>
  );
}

/** Разбор одной сохранённой матрицы: расчёт, права на неё и печать разделов. */
export async function SavedReport({
  chosen,
  saved,
  access,
  embedded = false,
}: {
  chosen: SavedMatrix;
  saved: SavedMatrix[];
  access: Access;
  embedded?: boolean;
}) {
  let matrix;
  try {
    matrix = calculate(chosen.birth, chosen.sex);
  } catch {
    notFound();
  }

  const unlocked = await readMatrixUnlocked(chosen.id);
  return (
    <ReportSheet
      matrix={matrix}
      sections={build(matrix, unlocked)}
      planName={planLabel(access, await getTariffs(), unlocked)}
      unlocked={unlocked}
      saved={saved}
      currentId={chosen.id}
      embedded={embedded}
    />
  );
}
