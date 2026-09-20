import type { Metadata } from "next";

import LegalDocView from "@/components/legal/LegalDoc";
import { ALL_FREE } from "@/lib/access";
import { D, L } from "@/lib/i18n";
import { TERMS } from "@/lib/legal/terms";
import { pageMeta } from "@/lib/site";
import { getTariffs } from "@/lib/tariffs.server";
import { priceLabel } from "@/lib/tariffs";

// Оферта — договор: цены в ней обязаны совпадать с теми, что спишет касса, поэтому страница
// печатается по запросу и читает прайс из базы.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const prices = (await getTariffs()).map((t) => priceLabel(t)).join(" / ");
  return pageMeta({
    title: D.pages.termsTitle[L],
    description: ALL_FREE
      ? D.pages.termsDescriptionFree[L]
      : D.pages.termsDescription[L](prices || D.pages.termsPricesUnknown[L]),
    path: "/terms",
  });
}

export default async function OfertaPage() {
  const tariffs = await getTariffs();
  return <LegalDocView doc={TERMS[L]} crumb={D.nav.terms[L]} tariffs={tariffs} />;
}
