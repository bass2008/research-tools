import { requestSite } from "@/lib/siteProfile.server";
import { robotsForSite } from "@/lib/robotsPolicy";

export const dynamic = "force-dynamic";

export default async function robots() {
  return robotsForSite(await requestSite());
}
