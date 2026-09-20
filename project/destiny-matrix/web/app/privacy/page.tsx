import type { Metadata } from "next";

import LegalDocView from "@/components/legal/LegalDoc";
import { D, L } from "@/lib/i18n";
import { PRIVACY } from "@/lib/legal/privacy";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: D.pages.privacyTitle[L],
  description: D.pages.privacyDescription[L],
  path: "/privacy",
});

export default function PrivacyPage() {
  return <LegalDocView doc={PRIVACY[L]} crumb={D.nav.privacy[L]} />;
}
