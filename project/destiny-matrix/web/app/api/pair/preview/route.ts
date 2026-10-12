import { requestLocale } from "@/lib/i18n/request";
import type { Points } from "@/lib/pair/engine";
import { PREVIEW_POINTS, previewUnits, unit } from "@/lib/pair/corpus";
import { BUSINESS_FREE } from "@/lib/pair/business";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Бесплатная часть разбора пары: тексты двух открытых сфер и подписи главных карт.
 *
 * Ключом идут числа пары, а не даты: по сумме двух матриц дату не восстановить, и правило «дата
 * не уходит с клиента» остаётся в силе. Платные сферы по числам не отдаются.
 */
export async function GET(request: Request) {
  const locale = await requestLocale(request);
  const params = new URL(request.url).searchParams;
  const p = {} as Points;
  for (const key of PREVIEW_POINTS) {
    const value = Number(params.get(key));
    if (!Number.isInteger(value) || value < 1 || value > 22) return new NextResponse("Bad request", { status: 400 });
    p[key] = value;
  }
  const units = previewUnits(locale, p);
  // открытые деловые сферы — тоже по числам: деловой матрицы по ним не восстановить, дат — тем более
  for (const id of BUSINESS_FREE) {
    const raw = params.get(id);
    if (raw === null) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 22) return new NextResponse("Bad request", { status: 400 });
    units[`business:${id}:${n}`] = unit(locale, `business:${id}:${n}`);
  }
  return NextResponse.json(
    { units },
    { headers: { "Cache-Control": "private, no-store", "Content-Language": locale } },
  );
}
