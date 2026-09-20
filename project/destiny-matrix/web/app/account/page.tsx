import { D, L } from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";

import AccountView from "@/components/account/AccountView";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: D.pages.accountTitle[L],
  description: D.pages.accountDescription[L],
  path: "/account",
  noindex: true,
});

export default function AccountPage() {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">{D.nav.home[L]}</Link> <span>/</span> <span>{D.nav.account[L]}</span>
        </p>
        <h1>{D.pages.accountTitle[L]}</h1>
        <AccountView />
      </div>
    </main>
  );
}
