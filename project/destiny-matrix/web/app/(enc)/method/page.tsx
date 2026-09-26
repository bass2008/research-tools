import { requestSite } from "@/lib/siteProfile.server";
import HubArticle, { forLocale as localizedHubArticle } from "@/components/enc/HubArticle";
import { forLocale as localizedContent } from "@/lib/content";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const forLocale = localized((L: Locale, site) => {
  const { hubMeta } = localizedHubArticle(L, site);
  const { hub } = localizedContent(L);

  const KEY = "method";
  return { hubMeta, hub, KEY };
});

export async function generateMetadata(): Promise<Metadata> {
  const L = await publicLocale();
  const { hubMeta, KEY } = forLocale(L, await requestSite());

  return hubMeta(KEY);
}

export default async function Page() {
  const L = await requestLocale();
  const { hub, KEY } = forLocale(L, await requestSite());

  const item = hub(KEY);
  // если статью убрали из hubs.json, адрес отдаёт 404, а не падает
  if (!item) notFound();
  return <HubArticle locale={L} item={item} />;
}
