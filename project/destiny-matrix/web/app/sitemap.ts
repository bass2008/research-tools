import { requestSite } from "@/lib/siteProfile.server";
import { sitemapForSite } from "@/lib/sitemapEntries";

export const dynamic = "force-dynamic";

export default async function sitemap() {
  return sitemapForSite(await requestSite());
}
