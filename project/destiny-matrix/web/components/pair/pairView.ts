import { DP } from "@/lib/i18n/dict/pair";
import type { Lang as Locale } from "@/lib/i18n/lang";
import { computePair, type PairResult } from "@/lib/pair/engine";
import { pairTitle } from "@/lib/pair/title";

interface Partner {
  birth?: unknown;
  name?: unknown;
}

/** Ввод сохранённой пары → расчёт и подписи. null — ввод испорчен или дата невозможна. */
export function pairView(inputs: Record<string, unknown>, L: Locale): {
  result: PairResult; title: string; names: { a: string; b: string }; dates: { a: string; b: string };
} | null {
  const a = inputs.a as Partner | undefined;
  const b = inputs.b as Partner | undefined;
  if (typeof a?.birth !== "string" || typeof b?.birth !== "string") return null;
  try {
    return {
      result: computePair(a.birth, b.birth, L),
      title: pairTitle(L, { birth: a.birth, name: typeof a.name === "string" ? a.name : null },
        { birth: b.birth, name: typeof b.name === "string" ? b.name : null }),
      names: {
        a: typeof a.name === "string" && a.name ? a.name : DP.partnerA[L],
        b: typeof b.name === "string" && b.name ? b.name : DP.partnerB[L],
      },
      dates: { a: a.birth, b: b.birth },
    };
  } catch {
    return null;
  }
}
