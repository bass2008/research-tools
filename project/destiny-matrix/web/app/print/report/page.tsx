import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ReportSheet from "@/components/ReportSheet";
import { calculate } from "@/lib/matrix";
import { build } from "@/lib/sections";
import { pageMeta } from "@/lib/site";

import { readPrintPage } from "../../_lib/access";

// Страница существует ради PDF: её открывает браузерный сервис по одноразовому пропуску.
// Ни индексации, ни кеша — на ней платный разбор с датой рождения.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Разбор для печати",
  description: "Служебная страница печати разбора в PDF.",
  path: "/print/report",
  noindex: true,
});

type Search = Promise<Record<string, string | string[] | undefined>>;

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
          saved={[]}
          currentId={page.id}
          printing
        />
      </div>
    </main>
  );
}
