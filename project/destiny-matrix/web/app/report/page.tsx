import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ReportSheet from "@/components/ReportSheet";
import ReportView from "@/components/ReportView";
import { calculate } from "@/lib/matrix";
import { build, freePositionTexts } from "@/lib/sections";
import { pageMeta } from "@/lib/site";
import { getTariffs } from "@/lib/tariffs";

import { pickMatrix, planLabel, readAccess, readMatrixUnlocked, readSavedMatrices } from "../_lib/access";

// Страница печатается на запрос: доступ к платным разделам знает только сервер — по
// httpOnly-куке. Предрендер здесь означал бы, что толкования всех платных разделов лежат в
// готовом HTML и видны любому, кто откроет исходник.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Мой разбор матрицы судьбы",
  description:
    "Личный отчёт по матрице судьбы: октаграмма, позиции карты и два открытых раздела, " +
    "остальные — в полном разборе.",
  path: "/report",
  noindex: true,
});

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportPage({ searchParams }: { searchParams: Search }) {
  const wanted = (await searchParams).m;
  const access = await readAccess();

  if (!access.paid) {
    return (
      <Sheet>
        {access.offline ? (
          <div className="err">
            Сервер не подтвердил доступ, поэтому платные разделы закрыты. Обновите страницу — доступ
            проверяется заново.
          </div>
        ) : null}
        <ReportView texts={freePositionTexts()} />
      </Sheet>
    );
  }

  const saved = await readSavedMatrices();
  const chosen = pickMatrix(saved, wanted);
  if (!chosen) {
    // явный `?m=` на чужую или несуществующую матрицу — это 404, а не «покажем свою»
    if (wanted) notFound();
    return (
      <Sheet>
        <ReportView granted={access.paid} texts={freePositionTexts()} />
      </Sheet>
    );
  }

  let matrix;
  try {
    matrix = calculate(chosen.birth, chosen.sex);
  } catch {
    notFound();
  }

  const unlocked = await readMatrixUnlocked(chosen.id);
  return (
    <Sheet>
      <ReportSheet
        matrix={matrix}
        sections={build(matrix, unlocked)}
        planName={planLabel(access, await getTariffs(), unlocked)}
        saved={saved}
        currentId={chosen.id}
      />
    </Sheet>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <div className="wrap">
        {children}
        <p className="small center" style={{ marginTop: 18 }}>
          <Link href="/account">Кабинет</Link> · <Link href="/encyclopedia">Энциклопедия</Link>
        </p>
      </div>
    </main>
  );
}
