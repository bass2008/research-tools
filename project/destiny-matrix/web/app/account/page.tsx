import { requestSite } from "@/lib/siteProfile.server";
import AccountView from "@/components/account/AccountView";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);

  const metadata: Metadata = pageMeta({
    title: D.pages.accountTitle[L],
    description: D.pages.accountDescription[L],
    path: "/account",
    noindex: true,
  });
  return { pageMeta, metadata };
});

export default async function AccountPage() {
  const L = await requestLocale();

  return (
    <main id="content" className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">{D.nav.home[L]}</Link> <span>/</span> <span>{D.nav.account[L]}</span>
        </p>
        <h1>{D.pages.accountTitle[L]}</h1>
        <AccountView locale={L} />
      </div>
    </main>
  );
}
export async function generateMetadata() {
  return forLocale(await requestLocale(), await requestSite()).metadata;
}
