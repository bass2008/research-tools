import { D, L } from "@/lib/i18n";
import type { Metadata } from "next";

import ForgotForm from "@/components/account/ForgotForm";
import { pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: D.pages.forgotTitle[L],
  description: D.pages.forgotDescription[L],
  path: "/forgot",
  noindex: true,
});

export default function Page() {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <ForgotForm />
      </div>
    </main>
  );
}
