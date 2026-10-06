import type { ReactNode } from "react";

// Heading that the encyclopedia frame lists in the "This article" menu. The frame shows the menu
// only on pages whose article carries a `data-toc-root` — the server decides, so nothing shifts.
export const TOC_MIN = 5;

export default function TocHeading({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} data-toc="">{children}</h2>;
}
