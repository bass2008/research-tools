import { headers } from "next/headers";
import type { Lang } from "./hosts";
import { requestSite } from "../siteProfile.server";
import { renderLocale, selectedLocale } from "./requestPolicy";

/** Resolve independently for each request. Cookies never change the API or the storefront. */
export async function requestLocale(request?: Request): Promise<Lang> {
  const site = await requestSite(request);
  return request ? selectedLocale(request.headers, site, true) : renderLocale(await headers(), site);
}

export async function publicLocale(): Promise<Lang> {
  return (await requestSite()).defaultLocale;
}
