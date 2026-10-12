import { allOffers, getBilling } from "@/lib/tariffs.server";
import { forward } from "../_lib/upstream";

export const dynamic = "force-dynamic";

// Прайс браузеру: статические страницы собраны заранее и цену из базы напечатать не могут,
// поэтому кнопки покупки дочитывают её отсюда. Без продукта — витрина личного разбора.
export async function GET(req: Request) {
  const product = new URL(req.url).searchParams.get("product") ?? "";
  if (product === "all") {
    const [items, billing] = await Promise.all([allOffers(), getBilling()]);
    return Response.json({ items, payment_providers: billing.providers });
  }
  return forward(/^[a-z]{1,32}$/.test(product) ? `/tariffs?product=${product}` : "/tariffs", { source: req });
}
