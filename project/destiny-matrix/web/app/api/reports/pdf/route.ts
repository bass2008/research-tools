import { requestLocale } from "@/lib/i18n/request";
import { D } from "@/lib/i18n";
import { forward, jsonError, readJson } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const L = await requestLocale(req);
  const body = await readJson(req);
  const matrixId = Number(body.matrix_id);
  if (!Number.isInteger(matrixId) || matrixId <= 0) return jsonError(D.bffErrors.badMatrix, L, 400);
  // печать идёт синхронно и на слабом CPU занимает десятки секунд: апстриму нужен весь его таймаут
  return forward("/reports/render", { source: req, method: "POST", body: { matrix_id: matrixId }, auth: true });
}
