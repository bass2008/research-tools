"use client";

import { useEffect } from "react";
import { D } from "@/lib/i18n";
import FooterContent from "./FooterContent";
import Header from "./Header";
import { useLocale, useSite } from "./LocaleProvider";
import NotFoundBody from "./NotFoundBody";

/** Keep the standalone 404 document interactive without refreshing a missing route. */
export default function GlobalNotFoundContent() {
  const locale = useLocale();
  const site = useSite();
  useEffect(() => { document.title = D.meta.notFoundTitle[locale]; }, [locale]);
  return <>
    <Header locale={locale} plain />
    <main id="content" className="page">
      <NotFoundBody locale={locale} />
    </main>
    <FooterContent locale={locale} site={site} plain />
  </>;
}
