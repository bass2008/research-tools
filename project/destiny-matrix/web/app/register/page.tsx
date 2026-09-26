import { requestSite } from "@/lib/siteProfile.server";
import AuthForm from "@/components/account/AuthForm";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);

  const metadata: Metadata = pageMeta({
    title: D.pages.registerTitle[L],
    description: D.pages.registerDescription[L],
    path: "/register",
    noindex: true,
  });
  return { pageMeta, metadata };
});

export default async function RegisterPage() {
  const L = await requestLocale();

  return (
    <main id="content" className="page">
      <div className="wrap">
        <AuthForm locale={L} mode="register" />
      </div>
    </main>
  );
}
export async function generateMetadata() {
  return forLocale(await requestLocale(), await requestSite()).metadata;
}
