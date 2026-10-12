import { D } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError, readJson } from "../_lib/upstream";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const product = new URL(req.url).searchParams.get("product") ?? "";
  return forward(/^[a-z]{1,32}$/.test(product) ? `/readings?product=${product}` : "/readings", { source: req, auth: true });
}

// Ввод сохраняется только по явному действию вошедшего человека; проверяет его апстрим по
// правилам продукта, здесь — только форма.
export async function POST(req: Request) {
  const L = await requestLocale(req);
  const body = await readJson(req);
  const product = String(body.product ?? "");
  if (!/^[a-z]{1,32}$/.test(product) || typeof body.inputs !== "object" || body.inputs === null) {
    return jsonError(D.bffErrors.badDate, L, 400);
  }
  const title = body.title === undefined || body.title === null ? undefined : String(body.title).slice(0, 200);
  return forward("/readings", { source: req, method: "POST", auth: true, body: { product, inputs: body.inputs, title } });
}
