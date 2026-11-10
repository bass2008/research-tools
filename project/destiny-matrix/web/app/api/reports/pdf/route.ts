import { requestLocale } from "@/lib/i18n/request";
import { D } from "@/lib/i18n";
import { forward, jsonError, readJson } from "../../_lib/upstream";
import { requestSite } from "@/lib/siteProfile.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const L = await requestLocale(req);
  const body = await readJson(req);
  const readingId = Number(body.reading_id ?? body.matrix_id);
  if (!Number.isInteger(readingId) || readingId <= 0) return jsonError(D.bffErrors.badMatrix, L, 400);
  // печать идёт синхронно и на слабом CPU занимает десятки секунд: апстриму нужен весь его таймаут
  const response = await forward("/reports/render", { source: req, method: "POST", body: { reading_id: readingId }, auth: true });
  if (!response.ok) return response;
  const result = await response.clone().json();
  if (typeof result.url === "string") {
    const site = await requestSite(req);
    const url = new URL(result.url, site.origin);
    // Same-origin signed downloads must also work through the emulator/LAN host aliases.
    if (url.origin === site.origin) result.url = `${url.pathname}${url.search}`;
  }
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
