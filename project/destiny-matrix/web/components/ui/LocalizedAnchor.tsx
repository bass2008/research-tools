"use client";

import { navigationHref } from "@/lib/publicRouting";
import { useLocale, useSite } from "./LocaleProvider";

/** Plain navigation for SVG points, printable reports and the standalone 404 document. */
export default function LocalizedAnchor({ href, ...props }: React.ComponentProps<"a">) {
  const site = useSite();
  const locale = useLocale();
  return <a {...props} href={href ? navigationHref(href, site, locale) : href} />;
}
