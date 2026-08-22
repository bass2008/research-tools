import type { Metadata } from "next";

import PayResult from "@/components/PayResult";
import { pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Платёж не прошёл",
  description: "Возврат с платёжной формы: платёж не состоялся.",
  path: "/pay/fail",
  noindex: true,
});

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function PayFailPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const order = String((Array.isArray(params.order) ? params.order[0] : params.order) ?? "");
  return (
    <main className="page">
      <div className="wrap narrow">
        <PayResult order={order} outcome="fail" />
      </div>
    </main>
  );
}
