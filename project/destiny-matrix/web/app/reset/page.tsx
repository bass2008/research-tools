import { requestSite } from "@/lib/siteProfile.server";
import ResetForm from "@/components/account/ResetForm";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);

  const metadata: Metadata = pageMeta({
    title: D.pages.resetTitle[L],
    description: D.pages.resetDescription[L],
    path: "/reset",
    noindex: true,
  });
  return { pageMeta, metadata };
});

export default async function Page() {
  const L = await requestLocale();

  return (
    <main id="content" className="page">
      <div className="wrap">
        <ResetForm locale={L} />
      </div>
    </main>
  );
}
export async function generateMetadata() {
  return forLocale(await requestLocale(), await requestSite()).metadata;
}
