import EncShell from "@/components/enc/EncShell";
import { requestLocale } from "@/lib/i18n/request";
import type { ReactNode } from "react";

// Статьи-хабы живут по своим адресам (/energies, /programs, …), но открываются в том же
// каркасе справочника: группа в скобках не попадает в путь, поэтому URL не меняются.
export default async function ArticlesLayout({ children }: { children: ReactNode }) {
  const L = await requestLocale();

  return <EncShell locale={L}>{children}</EncShell>;
}
