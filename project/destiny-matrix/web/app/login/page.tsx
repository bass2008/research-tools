import { D, L } from "@/lib/i18n";
import type { Metadata } from "next";

import AuthForm from "@/components/account/AuthForm";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: D.pages.loginTitle[L],
  description: D.pages.loginDescription[L],
  path: "/login",
  noindex: true,
});

export default function LoginPage() {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
