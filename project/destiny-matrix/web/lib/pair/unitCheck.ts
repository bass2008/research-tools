// Требования к юниту корпуса пары — одни для теста полноты и для проверки файлов писателей.
// Поля и объём сняты с эталонных юнитов: у сочетаний и точек заголовок и три абзаца, у блоков
// (родители, характеры, деловой раздел) один абзац без заголовка.
import type { Lang as Locale } from "../i18n/lang";
import { forLocale as localizedTextPolicy } from "../textPolicy";
import { SPHERES, type PairUnit } from "./spheres";

export const LIMITS = { title: 32, meaning: 125, caption: 60, cards: [800, 1400], block: [400, 700] } as const;

export const paragraphs = (u: PairUnit): string[] => (Array.isArray(u.text) ? u.text : u.text ? [u.text] : []);

export function unitProblems(u: PairUnit, locale: Locale = "ru"): string[] {
  const out: string[] = [];
  const family = u.unit.split(":")[0];
  // блоки — одна точка, один абзац: родители, характеры и деловой раздел
  const block = family === "parents" || family === "characters" || family === "business";
  const sphere = SPHERES.find((s) => s.id === family);
  const points = block ? [u.unit.split(":")[1]] : (sphere?.cards ?? []).map(([k]) => k);
  const text = paragraphs(u);
  const chars = text.join("").length;
  const [min, max] = block ? LIMITS.block : LIMITS.cards;
  if (!block && !u.title?.trim()) out.push("нет заголовка");
  if (u.title && u.title.length > LIMITS.title) out.push(`заголовок ${u.title.length} > ${LIMITS.title}`);
  if (!u.meaning?.trim()) out.push("нет строки «Главное»");
  if (u.meaning && u.meaning.length > LIMITS.meaning) out.push(`«Главное» ${u.meaning.length} > ${LIMITS.meaning}`);
  const bare = (v: string) => v.trim().replace(/\.$/, "");
  if (u.meaning && Object.values(u.captions ?? {}).some((c) => c && bare(c) === bare(u.meaning!))) {
    out.push("«Главное» повторяет подпись карты");
  }
  for (const k of points) {
    const caption = u.captions?.[k];
    if (!caption?.trim()) out.push(`нет подписи ${k}`);
    else if (caption.length > LIMITS.caption) out.push(`подпись ${k} ${caption.length} > ${LIMITS.caption}`);
  }
  if (!text.length || text.some((t) => !t.trim())) out.push("нет текста");
  else if (block ? text.length !== 1 : text.length !== 3) out.push(`абзацев ${text.length}, нужно ${block ? 1 : 3}`);
  if (text.length && (chars < min || chars > max)) out.push(`текст ${chars} знаков, нужно ${min}–${max}`);
  const policy = localizedTextPolicy(locale).blockedTextMatch([u.title, u.meaning, ...Object.values(u.captions ?? {}), ...text].join("\n"));
  if (policy) out.push(`запрет «${policy.matched}» (${policy.category})`);
  return out;
}

/** Повторы заголовков и строк «Главное» внутри семейства. */
export function duplicates(units: Iterable<PairUnit>): string[] {
  const seen = new Map<string, string>();
  const dup: string[] = [];
  for (const u of units) {
    const family = u.unit.split(":")[0];
    for (const v of [u.title, u.meaning]) {
      if (!v) continue;
      const key = `${family}|${v.trim().toLowerCase()}`;
      if (seen.has(key)) dup.push(`${seen.get(key)} = ${u.unit}: «${v}»`);
      else seen.set(key, u.unit);
    }
  }
  return dup;
}
