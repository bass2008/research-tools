import EncShell from "@/components/enc/EncShell";
import { requestLocale } from "@/lib/i18n/request";
import type { ReactNode } from "react";

export default async function EncyclopediaLayout({ children }: { children: ReactNode }) {
  const L = await requestLocale();

  return <EncShell locale={L}>{children}</EncShell>;
}
