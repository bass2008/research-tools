import { forward, readJson, jsonError } from "@/app/api/_lib/upstream";
import { requestLocale } from "@/lib/i18n/request";
import { pairSnapshot, personalSnapshot } from "@/app/api/_lib/automaticSnapshot";
import { INDIVIDUAL_KINDS } from "@/lib/individualReading";
import type { IndividualRequest } from "@/lib/individualReading";

export const dynamic = "force-dynamic";
export function GET(req: Request) {
  return forward("/admin/individual-readings" + new URL(req.url).search, { auth: true, source: req });
}
export async function POST(req: Request) {
  // Check admin before reading the full interpretation corpus.
  const access = await forward("/admin/individual-readings?page_size=1", { auth: true, source: req });
  if (!access.ok) return access;
  const body = await readJson(req) as unknown as IndividualRequest;
  const L = body.locale === "en" ? "en" : "ru";
  let automatic_reading: unknown;
  try {
    const product = INDIVIDUAL_KINDS[body.kind].product;
    if (product === "pair") {
      const inputs = body.inputs as { a: { birth: string }; b: { birth: string } };
      automatic_reading = pairSnapshot(inputs.a.birth, inputs.b.birth, L);
    } else {
      automatic_reading = personalSnapshot(String(body.inputs.birth), String(body.inputs.sex), L);
    }
  } catch {
    return jsonError({ ru: "Проверьте даты рождения.", en: "Check the birth dates." }, await requestLocale(req), 422);
  }
  return forward("/admin/individual-readings", { auth: true, source: req, method: "POST", body: { ...body, automatic_reading } });
}
