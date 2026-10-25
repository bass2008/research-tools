"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { track, type GoalParams } from "@/lib/analytics";

/** Ссылка покупки из разбора, который также рендерится на сервере и для PDF. */
export default function BuyLink({ analytics, ...props }: ComponentProps<typeof Link> & {
  analytics: GoalParams;
}) {
  return <Link {...props} onClick={() => track("buy_click", analytics)} />;
}
