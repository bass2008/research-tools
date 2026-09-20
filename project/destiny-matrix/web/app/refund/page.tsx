import type { Metadata } from "next";

import LegalDocView from "@/components/legal/LegalDoc";
import { D, L } from "@/lib/i18n";
import { REFUND } from "@/lib/legal/refund";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: D.pages.refundTitle[L],
  description: D.pages.refundDescription[L],
  path: "/refund",
});

export default function RefundPage() {
  return <LegalDocView doc={REFUND[L]} crumb={D.nav.refund[L]} />;
}
