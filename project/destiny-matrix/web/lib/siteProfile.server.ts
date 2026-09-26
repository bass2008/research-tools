import { headers } from "next/headers";
import { resolveSite } from "./siteProfile.config";

export async function requestSite(request?: Request) {
  const source = request?.headers ?? await headers();
  // The reverse proxy must preserve Host. Never trust a visitor's X-Forwarded-Host.
  const site = resolveSite(source.get("host") ?? (request ? new URL(request.url).host : null));
  if (!site) throw new Error("Unknown site host");
  return site;
}

/** Only the configured origin crosses the BFF boundary, never a visitor-supplied header. */
export async function requestSiteHeaders(request?: Request): Promise<Record<string, string>> {
  return { "X-Arcana-Site-Origin": (await requestSite(request)).origin };
}
