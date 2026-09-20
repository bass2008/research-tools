import { D, L } from "@/lib/i18n";
import type { Metadata } from "next";

import ResetForm from "@/components/account/ResetForm";
import { pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: D.pages.resetTitle[L],
  description: D.pages.resetDescription[L],
  path: "/reset",
  noindex: true,
});

export default function Page() {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <ResetForm />
      </div>
    </main>
  );
}
