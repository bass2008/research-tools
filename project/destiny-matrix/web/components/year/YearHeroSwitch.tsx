"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLocale } from "@/components/ui/LocaleProvider";
import { splitPublicPath } from "@/lib/publicRouting";
import YearReadingBanner from "./YearReadingBanner";

// The encyclopedia layout is kept across client navigation, so the page is read from the live address.
export default function YearHeroSwitch({ children, year, years, price }: { children: ReactNode; year: number; years: [number, number]; price: number }) {
  const L = useLocale();
  const path = splitPublicPath(usePathname() ?? "/").path;
  const page = L === "ru" ? /^\/year(?:\/(\d{1,2}))?\/?$/.exec(path) : null;
  if (!page) return <>{children}</>;
  return <div className="wrap yb-hero">
    <YearReadingBanner key={path} place="top" arcanum={page[1] ? Number(page[1]) : undefined} year={year} years={years} price={price} />
  </div>;
}
