import { upstreamUrl, json } from "@/app/api/_lib/upstream";
export const dynamic = "force-dynamic";

/** Pub/Sub uses a Google-signed identity, never an Arcana cookie or mobile session. */
export async function POST(req: Request) {
  const body = await req.text();
  if (body.length > 100_000) return json({ detail: "Payload too large" }, 413);
  try {
    const response = await fetch(upstreamUrl("/mobile/billing/rtdn"), {
      method: "POST", cache: "no-store", body,
      headers: { "Content-Type": "application/json", Authorization: req.headers.get("authorization") ?? "" },
    });
    return json(await response.json(), response.status);
  } catch {
    return json({ detail: "Notification could not be processed" }, 502);
  }
}
