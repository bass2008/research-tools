import type { Metadata } from "next";

import LegalDocView from "@/components/legal/LegalDoc";
import { D, L } from "@/lib/i18n";
import { SUPPORT } from "@/lib/legal/support";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: D.pages.supportTitle[L],
  description: D.pages.supportDescription[L],
  path: "/support",
});

export default function SupportPage() {
  return <LegalDocView doc={SUPPORT[L]} crumb={D.nav.support[L]} />;
}
