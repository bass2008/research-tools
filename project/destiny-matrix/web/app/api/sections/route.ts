import { parseSlug } from "@/app/matrix/matrices";
import { ALL_FREE } from "@/lib/access";
import { forLocale as contentForLocale } from "@/lib/content";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as sectionsForLocale } from "@/lib/sections";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Полный разбор карты для браузера — только на витрине без оплаты.
 *
 * Ключом идёт слаг карты (`14-6-7`), а не дата рождения: слаг — три свёрнутых числа, по ним
 * дату не восстановить, и правило «дата не уходит с клиента» остаётся в силе. Пол не спрашиваем
 * — на числа карты он не влияет.
 *
 * Пока касса работает, маршрут не существует: иначе платные толкования забирал бы кто угодно
 * одним запросом.
 */
export async function GET(request: Request) {
  const locale = await requestLocale(request);
  const { matrixItem } = contentForLocale(locale);
  const { build, withPositionArticles } = sectionsForLocale(locale);
  if (!ALL_FREE) return new NextResponse("Not found", { status: 404 });
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const item = parseSlug(slug) && matrixItem(slug);
  if (!item) return new NextResponse("Not found", { status: 404 });
  const matrix = item.matrix;
  return NextResponse.json(
    { sections: withPositionArticles(matrix, build(matrix, true)) },
    { headers: { "Cache-Control": "private, no-store", "Content-Language": locale } },
  );
}
