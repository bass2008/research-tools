import { requestSite } from "@/lib/siteProfile.server";
import ForgotForm from "@/components/account/ForgotForm";
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
    title: D.pages.forgotTitle[L],
    description: D.pages.forgotDescription[L],
    path: "/forgot",
    noindex: true,
  });
  return { pageMeta, metadata };
});

export default async function Page() {
  const L = await requestLocale();

  return (
    <main id="content" className="page">
      <div className="wrap">
        <ForgotForm locale={L} />
      </div>
    </main>
  );
}
export async function generateMetadata() {
  return forLocale(await requestLocale(), await requestSite()).metadata;
}
