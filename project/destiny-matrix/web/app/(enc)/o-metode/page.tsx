import type { Metadata } from "next";
import { notFound } from "next/navigation";

import HubArticle, { hubMeta } from "@/components/enc/HubArticle";
import { hub } from "@/lib/content";

const KEY = "o-metode";

export function generateMetadata(): Metadata {
  return hubMeta(KEY);
}

export default function Page() {
  const item = hub(KEY);
  // если статью убрали из hubs.json, адрес отдаёт 404, а не падает
  if (!item) notFound();
  return <HubArticle item={item} />;
}
