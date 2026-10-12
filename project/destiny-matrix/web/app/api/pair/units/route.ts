import { readAccess } from "@/app/_lib/access";
import { ALL_FREE } from "@/lib/access";
import { requestLocale } from "@/lib/i18n/request";
import { unit } from "@/lib/pair/corpus";
import type { PairUnit } from "@/lib/pair/spheres";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Полный разбор пары подписчику прямо в калькуляторе. Браузер присылает ключи юнитов — числа
 * сфер, а не даты: правило «дата не уходит с клиента» остаётся в силе и здесь.
 */
export async function GET(request: Request) {
  const keys = (new URL(request.url).searchParams.get("keys") ?? "").split(",").filter(Boolean);
  if (!keys.length || keys.length > 100 || keys.some((k) => !/^[a-z]+:[\w:.+-]{1,40}$/.test(k))) {
    return new NextResponse("Bad request", { status: 400 });
  }
  if (!ALL_FREE && !(await readAccess()).subscribed.includes("pair")) return new NextResponse("Not found", { status: 404 });
  const locale = await requestLocale(request);
  const units: Record<string, PairUnit | null> = {};
  for (const key of keys) units[key] = unit(locale, key);
  return NextResponse.json(
    { units: units },
    { headers: { "Cache-Control": "private, no-store", "Content-Language": locale } },
  );
}
