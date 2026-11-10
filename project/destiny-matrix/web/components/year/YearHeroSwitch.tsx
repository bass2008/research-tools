"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLocale } from "@/components/ui/LocaleProvider";
import { splitPublicPath } from "@/lib/publicRouting";
import YearLinksOffer from "./YearLinksOffer";

// The encyclopedia layout is kept across client navigation, so the page is read from the live address.
export default function YearHeroSwitch({ children, year, years, price }: { children: ReactNode; year: number; years: [number, number]; price: number }) {
  const L = useLocale();
  const path = splitPublicPath(usePathname() ?? "/").path;
  const page = L === "ru" ? /^\/encyclopedia\/(?:year(?:\/\d{1,2})?|month)\/?$/.exec(path) : null;
  if (!page) return <>{children}</>;
  return <div className="wrap yb-hero">
    <YearLinksOffer key={path} place="top" year={year} years={years} price={price} />
  </div>;
}
