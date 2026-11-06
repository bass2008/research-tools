"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import SiteLink from "@/components/ui/SiteLink";
import { track } from "@/lib/analytics";
import { D } from "@/lib/i18n";

export default function IndividualNavLink({ plain }: { plain?: boolean }) {
  const L = useLocale();
  return <SiteLink plain={plain} className="hnav-ind" data-testid="nav-individual" href="/individual"
    onClick={() => track("individual_click", { place: "header" })}>✦ {D.nav.individual[L]}</SiteLink>;
}
