import { D, L } from "@/lib/i18n";
import type { Metadata } from "next";

import AuthForm from "@/components/account/AuthForm";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: D.pages.registerTitle[L],
  description: D.pages.registerDescription[L],
  path: "/register",
  noindex: true,
});

export default function RegisterPage() {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <AuthForm mode="register" />
      </div>
    </main>
  );
}
