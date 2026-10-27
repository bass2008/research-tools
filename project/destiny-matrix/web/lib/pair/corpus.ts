// Корпус текстов пары читается только на сервере: толкования — товар, в клиентский чанк они
// не попадают (сторож — scripts/check-build.cjs). Браузер получает тексты по числам через BFF,
// и только открытые ему.
import fs from "node:fs";
import path from "node:path";
import type { Lang as Locale } from "../i18n/lang";
import { businessMatrix, businessPoints, businessUnitKeys } from "./business";
import { pairChakraKeys } from "./chakraReading";
import type { PairResult, Points } from "./engine";
import { FREE, MAIN, sphereOf, unitKeys, visible, type PairUnit } from "./spheres";

const cache = new Map<Locale, Map<string, PairUnit>>();
const tailCache = new Map<Locale, Map<string, PairUnit>>();

export const PAIR_TAIL_HUB = "/encyclopedia/compatibility/tails";

// Хвост пары со статьёй читается из корпуса статей: короткая версия и подписи написаны по
// полной статье, чтобы разбор и энциклопедия не расходились. Без статьи остаётся юнит.
function tails(locale: Locale): Map<string, PairUnit> {
  const hit = tailCache.get(locale);
  if (hit) return hit;
  const file = path.join(process.cwd(), "content", locale, "compatibility-karmic-tails.json");
  type Raw = { key: string; report?: PairUnit["report"]; unit?: { title: string; captions: Record<string, string>; meaning: string } };
  const items: Raw[] = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as { items: Raw[] }).items : [];
  const map = new Map<string, PairUnit>();
  for (const item of items) {
    if (!item.report?.length || !item.unit) continue;
    map.set(`tasks:${item.key}`, {
      unit: `tasks:${item.key}`, title: item.unit.title, captions: item.unit.captions, meaning: item.unit.meaning,
      text: null, report: item.report, article: `${PAIR_TAIL_HUB}/${item.key}`,
    });
  }
  tailCache.set(locale, map);
  return map;
}
const chakraCache = new Map<string, PairUnit>();

function load(locale: Locale): Map<string, PairUnit> {
  const hit = cache.get(locale);
  if (hit) return hit;
  // Перевода может не быть: тогда все разделы показываются заглушкой, а не падают.
  const file = path.join(process.cwd(), "content", locale, "pair-units.json");
  const items: PairUnit[] = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as { items: PairUnit[] }).items : [];
  const map = new Map(items.map((u) => [u.unit, u]));
  cache.set(locale, map);
  return map;
}

export function unit(locale: Locale, key: string): PairUnit | null {
  if (key.startsWith("chakra:")) {
    const found = /^chakra:(muladhara|svadhisthana|manipura|anahata|vishuddha|ajna|sahasrara|energy_field):(\d{1,2}-\d{1,2}-\d{1,2})$/.exec(key);
    if (!found) return null;
    const cacheKey = `${locale}:${key}`;
    const hit = chakraCache.get(cacheKey);
    if (hit) return hit;
    const file = path.join(process.cwd(), "content", "pair-chakras", locale, found[1], `${found[2]}.json`);
    if (!fs.existsSync(file)) return null;
    const body = JSON.parse(fs.readFileSync(file, "utf8")) as PairUnit;
    chakraCache.set(cacheKey, body);
    return body;
  }
  if (key.startsWith("tasks:")) {
    const article = tails(locale).get(key);
    if (article) return article;
  }
  return load(locale).get(key) ?? null;
}

/** Все юниты разбора пары: для открытого разбора — всех сфер. */
export function readingUnits(locale: Locale, a: Points, b: Points, p: Points): Record<string, PairUnit | null> {
  const out: Record<string, PairUnit | null> = {};
  for (const sphere of visible(a, b)) {
    for (const key of unitKeys(sphere, a, b, p)) out[key] = unit(locale, key);
  }
  return out;
}

/** Бесплатная часть: тексты открытых сфер целиком, у главных карт платных сфер — только подпись.
 *  Нужны только числа пары: по ним дату не восстановить. */
export function previewUnits(locale: Locale, p: Points): Record<string, PairUnit | null> {
  const out: Record<string, PairUnit | null> = {};
  for (const id of FREE) out[sphereOf(id).key!(p)] = unit(locale, sphereOf(id).key!(p));
  for (const main of MAIN) {
    const key = sphereOf(main.sphere).key!(p);
    if (key in out) continue;
    const full = unit(locale, key);
    const caption = full?.captions?.[main.key];
    out[key] = caption ? { unit: key, captions: { [main.key]: caption }, ...(full?.article ? { article: full.article } : {}) } : null;
  }
  return out;
}

/** Юниты разбора пары вместе с деловым разделом: открытый разбор — все, иначе бесплатная часть. */
export function pairUnits(locale: Locale, result: PairResult, dates: { a: string; b: string }, unlocked: boolean):
  Record<string, PairUnit | null> {
  const { a, b, p } = result;
  const out = unlocked ? readingUnits(locale, a, b, p) : previewUnits(locale, p);
  const business = businessPoints(businessMatrix(dates.a, dates.b, locale));
  for (const key of businessUnitKeys(business, !unlocked)) out[key] = unit(locale, key);
  if (unlocked) for (const key of pairChakraKeys(locale, dates)) out[key] = unit(locale, key);
  return out;
}

/** Числа, которые бесплатная часть берёт из пары, — и только они. */
export const PREVIEW_POINTS = ["A", "B", "E", "M", "N", "D", "spiritual"] as const;
