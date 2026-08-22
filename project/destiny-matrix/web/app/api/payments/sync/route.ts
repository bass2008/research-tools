import { forward, json, readJson } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const orderId = String(body.order_id ?? "");
  if (!/^arcana-\d+(-[0-9a-f]{4,16})?$/.test(orderId)) {
    return json({ detail: "Неверный номер заказа" }, 400);
  }
  return forward("/payments/sync", { method: "POST", body: { order_id: orderId }, auth: true });
}
