import { D } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError, readJson } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

// Без куки: возврат из приложения банка открывается окном, где сессии нет. Пускаем только номер
// со случайным хвостом — по голому `arcana-<id>` чужие заказы перебирались бы подряд.
export async function POST(req: Request) {
  const L = await requestLocale(req);
  const body = await readJson(req);
  const orderId = String(body.order_id ?? "");
  if (!/^arcana-\d+-[0-9a-f]{8}$/.test(orderId)) {
    return jsonError(D.bffErrors.badOrder, L, 400);
  }
  return forward("/payments/receipt", { source: req, method: "POST", body: { order_id: orderId } });
}
