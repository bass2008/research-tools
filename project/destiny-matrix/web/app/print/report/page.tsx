import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ReportSheet from "@/components/matrix/ReportSheet";
import { birthLabel, calculate } from "@/lib/matrix";
import { build } from "@/lib/sections";
import { pageMeta } from "@/lib/site";

import { readPrintPage } from "../../_lib/access";

type Search = Promise<Record<string, string | string[] | undefined>>;

// Страница существует ради PDF: её открывает браузерный сервис по одноразовому пропуску.
// Ни индексации, ни кеша — на ней платный разбор с датой рождения.
export const dynamic = "force-dynamic";

// Заголовок документа уезжает в свойства PDF: «Разбор для печати» ничего не говорит о том,
// чей это разбор, а файл человек хранит годами.
export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const params = await searchParams;
  const id = Number(Array.isArray(params.m) ? params.m[0] : params.m);
  const token = String((Array.isArray(params.t) ? params.t[0] : params.t) ?? "");
  const page = Number.isInteger(id) && id > 0 && token ? await readPrintPage(id, token) : null;
  return pageMeta({
    title: page ? `Матрица судьбы — ${birthLabel(page.birth)}` : "Разбор для печати",
    description: "Полный разбор матрицы судьбы по дате рождения.",
    path: "/print/report",
    noindex: true,
  });
}

export default async function PrintReportPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const id = Number(Array.isArray(params.m) ? params.m[0] : params.m);
  const token = String((Array.isArray(params.t) ? params.t[0] : params.t) ?? "");
  if (!Number.isInteger(id) || id <= 0 || !token) notFound();

  const page = await readPrintPage(id, token);
  if (!page) notFound();

  let matrix;
  try {
    matrix = calculate(page.birth, page.sex);
  } catch {
    notFound();
  }

  return (
    <main className="page printmode">
      <div className="wrap">
        <ReportSheet
          matrix={matrix}
          sections={build(matrix, page.unlocked)}
          planName={page.plan}
          unlocked={page.unlocked}
          saved={[]}
          currentId={page.id}
          printing
        />
      </div>
    </main>
  );
}
