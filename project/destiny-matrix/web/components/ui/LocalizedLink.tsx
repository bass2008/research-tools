"use client";

import NextLink from "next/link";
import { navigationHref } from "@/lib/publicRouting";
import { useLocale, useSite } from "./LocaleProvider";
import { usePrintHref } from "./PrintLinks";

/** Also renders the final URL in SSR, including links inside server-rendered articles. */
export default function LocalizedLink({ href, ...props }: React.ComponentProps<typeof NextLink>) {
  const site = useSite();
  const locale = useLocale();
  const printed = usePrintHref();
  if (printed && typeof href === "string") return <NextLink {...props} href={printed(href)} />;
  const localized = typeof href === "string" ? navigationHref(href, site, locale)
    : { ...href, pathname: href.pathname ? navigationHref(href.pathname, site, locale) : href.pathname };
  return <NextLink {...props} href={localized} />;
}
