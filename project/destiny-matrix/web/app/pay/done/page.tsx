import { requestSite } from "@/lib/siteProfile.server";
import PayResult from "@/components/pay/PayResult";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);

  const metadata: Metadata = pageMeta({
    title: D.payResult.donePageTitle[L],
    description: D.payResult.donePageDescription[L],
    path: "/pay/done",
    noindex: true,
  });
  return { pageMeta, metadata };
});

export default async function PayDonePage({ searchParams }: { searchParams: Search }) {
  const L = await requestLocale();

  const params = await searchParams;
  const order = String((Array.isArray(params.order) ? params.order[0] : params.order) ?? "");
  return (
    <main id="content" className="page">
      <div className="wrap narrow">
        <PayResult locale={L} order={order} outcome="done" />
      </div>
    </main>
  );
}
export async function generateMetadata() {
  return forLocale(await requestLocale(), await requestSite()).metadata;
}
