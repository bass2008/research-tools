import type { ReactNode } from "react";

import EncShell from "@/components/enc/EncShell";

export default function EncyclopediaLayout({ children }: { children: ReactNode }) {
  return <EncShell>{children}</EncShell>;
}
