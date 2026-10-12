import { readReading } from "@/app/_lib/access";
import { pairView } from "@/components/pair/pairView";
import { requestLocale } from "@/lib/i18n/request";
import { pairUnits } from "@/lib/pair/corpus";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Тексты открытой пары из кабинета прямо в калькуляторе: владелец и доступ проверяет API по сессии. */
export async function GET(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return new NextResponse("Bad request", { status: 400 });
  const row = await readReading(id);
  const locale = await requestLocale(request);
  const view = row?.product === "pair" && row.unlocked ? pairView(row.inputs, locale) : null;
  if (!view) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(
    { units: pairUnits(locale, view.result, view.dates, true) },
    { headers: { "Cache-Control": "private, no-store", "Content-Language": locale } },
  );
}
