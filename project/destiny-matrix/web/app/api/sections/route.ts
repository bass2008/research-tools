import { NextResponse } from "next/server";

import { ALL_FREE } from "@/lib/access";
import { matrixItem } from "@/lib/content";
import { parseSlug } from "@/app/matrix/matrices";
import { build, withPositionArticles } from "@/lib/sections";

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
export function GET(request: Request) {
  if (!ALL_FREE) return new NextResponse("Not found", { status: 404 });
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const item = parseSlug(slug) && matrixItem(slug);
  if (!item) return new NextResponse("Not found", { status: 404 });
  const matrix = item.matrix;
  return NextResponse.json(
    { sections: withPositionArticles(matrix, build(matrix, true)) },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
