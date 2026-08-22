import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NOT_FOUND_META } from "@/lib/seo";

// Перехват любого несуществующего адреса. Нужен только ради заголовка вкладки: not-found.tsx в
// metadata не участвует, поэтому 404 верхнего уровня показывался с заголовком главной.
export function generateMetadata(): Metadata {
  return NOT_FOUND_META;
}

export default function CatchAll() {
  notFound();
}
