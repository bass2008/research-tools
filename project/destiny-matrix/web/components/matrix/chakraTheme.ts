import type { CSSProperties } from "react";
import { ENERGY_FIELD_KEY } from "@/lib/readingTypes";

const palettes: Record<string, string[]> = {
  muladhara: ["#f2e2e1", "#864e4c", "#c3938f", "#e5ccca"],
  svadhisthana: ["#f5e7dc", "#845639", "#cba081", "#e9d6c5"],
  manipura: ["#f4eed8", "#725c2a", "#c3ab68", "#e8debd"],
  anahata: ["#e5eee5", "#41614a", "#92ae95", "#d2e0d0"],
  vishuddha: ["#e1f0f5", "#306477", "#86b5c4", "#cde2e9"],
  ajna: ["#e5e9f5", "#40557c", "#8d9fc5", "#d4dced"],
  sahasrara: ["#ece5f3", "#604772", "#a68abb", "#ded2e9"],
  [ENERGY_FIELD_KEY]: ["#e4efed", "#2f5d58", "#86b3ab", "#cfe2de"],
};

export function chakraTheme(key: string): CSSProperties {
  return Object.fromEntries(["--tone", "--ink", "--accent", "--edge"].map((name, i) => [name, palettes[key]?.[i]]));
}
