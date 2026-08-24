import type { Metadata } from "next";

import PayResult from "@/components/PayResult";
import { pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Результат оплаты",
  description: "Возврат с платёжной формы: проверяем платёж и открываем разбор.",
  path: "/pay/done",
  noindex: true,
});

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function PayDonePage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const order = String((Array.isArray(params.order) ? params.order[0] : params.order) ?? "");
  return (
    <main className="page">
      <div className="wrap narrow">
        <PayResult order={order} outcome="done" />
      </div>
    </main>
  );
}
