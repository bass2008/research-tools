"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { usePathname } from "next/navigation";

// Надпись справочника видна на всех страницах каркаса, но заголовком первого уровня она
// остаётся только на самой /encyclopedia: у детальных страниц свой h1.
export default function EncTitle({ locale: requestedLocale, ...localeProps }: ({}) & { locale?: Locale } = {}) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;

  const path = usePathname();
  const text = D.octagram.encTitle[L];
  if (path === "/encyclopedia") return <h1 className="enc-title">{text}</h1>;
  return (
    <div className="enc-title enc-title-sub" aria-hidden="true">
      {text}
    </div>
  );
}
