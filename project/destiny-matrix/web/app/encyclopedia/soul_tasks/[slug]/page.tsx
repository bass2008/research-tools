import { requestSite } from "@/lib/siteProfile.server";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale } from "../../_personal/reading";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(props: Props) {
  return forLocale(await publicLocale(), await requestSite()).personalReadingMetadata("soul_tasks")(props);
}

export default async function Page(props: Props) {
  return forLocale(await requestLocale(), await requestSite()).personalReadingPage("soul_tasks")(props);
}
