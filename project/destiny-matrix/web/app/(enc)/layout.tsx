import type { ReactNode } from "react";

import EncShell from "@/components/enc/EncShell";

// Статьи-хабы живут по своим адресам (/energies, /programs, …), но открываются в том же
// каркасе справочника: группа в скобках не попадает в путь, поэтому URL не меняются.
export default function ArticlesLayout({ children }: { children: ReactNode }) {
  return <EncShell>{children}</EncShell>;
}
