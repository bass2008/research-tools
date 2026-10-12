import { pickMatrix, readAccess, readMatrixUnlocked, readSavedMatrices } from "@/app/_lib/access";
import { parseSlug } from "@/app/matrix/matrices";
import { ALL_FREE } from "@/lib/access";
import { forLocale as contentForLocale } from "@/lib/content";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as matrixForLocale } from "@/lib/matrix";
import { forLocale as sectionsForLocale } from "@/lib/sections";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Полный разбор карты для браузера: по слагу — на витрине без оплаты, по `m=<id>` — владельцу
 * оплаченной сохранённой матрицы.
 *
 * Ключом идёт слаг карты (`14-6-7`), а не дата рождения: слаг — три свёрнутых числа, по ним
 * дату не восстановить, и правило «дата не уходит с клиента» остаётся в силе. Пол не спрашиваем
 * — на числа карты он не влияет.
 *
 * Пока касса работает, по слагу маршрут отвечает только подписчику: иначе платные толкования
 * забирал бы кто угодно одним запросом.
 *
 * `preview=locked` отвечает всем: закрытые разделы без толкований — карты позиций и заглушка
 * вместо текста чакр.
 */
export async function GET(request: Request) {
  const locale = await requestLocale(request);
  const { matrixItem } = contentForLocale(locale);
  const { build, withLockedPreview, withPositionArticles } = sectionsForLocale(locale);
  const params = new URL(request.url).searchParams;
  const only = params.get("section");
  const id = params.get("m");
  if (params.get("preview") === "locked") {
    const slug = params.get("slug") ?? "";
    const item = parseSlug(slug) && matrixItem(slug);
    if (!item) return new NextResponse("Not found", { status: 404 });
    return NextResponse.json(
      { sections: withLockedPreview(item.matrix, build(item.matrix, false)).filter((s) => s.locked) },
      { headers: { "Cache-Control": "private, no-store", "Content-Language": locale } },
    );
  }
  // A paid saved matrix: same owner list and upstream unlock check as the report page.
  if (id !== null) {
    const chosen = /^\d+$/.test(id) ? pickMatrix(await readSavedMatrices(), id) : null;
    if (!chosen || !(await readMatrixUnlocked(chosen.id))) {
      return new NextResponse("Not found", { status: 404 });
    }
    const matrix = matrixForLocale(locale).calculate(chosen.birth, chosen.sex);
    const sections = withPositionArticles(matrix, build(matrix, true)).filter((s) => !only || s.key === only);
    return NextResponse.json(
      { sections },
      { headers: { "Cache-Control": "private, no-store", "Content-Language": locale } },
    );
  }
  if (!ALL_FREE && !(await readAccess()).unlimited) return new NextResponse("Not found", { status: 404 });
  const slug = params.get("slug") ?? "";
  const item = parseSlug(slug) && matrixItem(slug);
  if (!item) return new NextResponse("Not found", { status: 404 });
  const matrix = item.matrix;
  return NextResponse.json(
    { sections: withPositionArticles(matrix, build(matrix, true)) },
    { headers: { "Cache-Control": "private, no-store", "Content-Language": locale } },
  );
}
