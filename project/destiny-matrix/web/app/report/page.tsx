import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ReportView from "@/components/matrix/ReportView";
import { freePositionTexts } from "@/lib/sections";
import { pageMeta } from "@/lib/site";

import { pickMatrix, readAccess, readSavedMatrices } from "../_lib/access";
import { SavedReport, Sheet } from "../_lib/report";

// Страница печатается на запрос: доступ к платным разделам знает только сервер — по
// httpOnly-куке. Предрендер здесь означал бы, что толкования всех платных разделов лежат в
// готовом HTML и видны любому, кто откроет исходник.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Мой разбор матрицы судьбы",
  description:
    "Личный отчёт по матрице судьбы: октаграмма, позиции карты и часть разделов бесплатно, " +
    "остальные — в полном разборе.",
  path: "/report",
  noindex: true,
});

type Search = Promise<Record<string, string | string[] | undefined>>;

const OTHER = <Link href="/encyclopedia">Энциклопедия</Link>;

export default async function ReportPage({ searchParams }: { searchParams: Search }) {
  const wanted = (await searchParams).m;
  const access = await readAccess();

  if (!access.paid) {
    // Дата из браузера и запись в кабинете связываются по id: без списка кнопка под бесплатным
    // разбором выбирала первую закрытую запись, а не ту, которую человек сейчас читает.
    const saved = access.authenticated ? await readSavedMatrices() : [];
    return (
      <Sheet other={OTHER}>
        {access.offline ? (
          <div className="err">
            Сервер не подтвердил доступ, поэтому платные разделы закрыты. Обновите страницу — доступ
            проверяется заново.
          </div>
        ) : null}
        <ReportView texts={freePositionTexts()} saved={saved} />
      </Sheet>
    );
  }

  const saved = await readSavedMatrices();
  const chosen = pickMatrix(saved, wanted);
  if (!chosen) {
    // явный `?m=` на чужую или несуществующую матрицу — это 404, а не «покажем свою»
    if (wanted) notFound();
    return (
      <Sheet other={OTHER}>
        <ReportView granted={access.paid} texts={freePositionTexts()} />
      </Sheet>
    );
  }

  return (
    <Sheet other={OTHER}>
      <SavedReport chosen={chosen} saved={saved} access={access} />
    </Sheet>
  );
}
