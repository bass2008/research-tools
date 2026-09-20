import type { Metadata } from "next";

import PayResult from "@/components/pay/PayResult";
import { D, L } from "@/lib/i18n";
import { pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: D.payResult.donePageTitle[L],
  description: D.payResult.donePageDescription[L],
  path: "/pay/done",
  noindex: true,
});

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function PayDonePage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const order = String((Array.isArray(params.order) ? params.order[0] : params.order) ?? "");
  return (
    <main id="content" className="page">
      <div className="wrap narrow">
        <PayResult order={order} outcome="done" />
      </div>
    </main>
  );
}
