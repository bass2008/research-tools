import type { MetadataRoute } from "next";

import { ARCANA } from "@/lib/arcana";
import { hubKeys, karmicTailKeys, yearKeys } from "@/lib/content";
import {
  KARMIC_TAIL_HUB,
  YEAR_HUB,
  CHAKRA_PAGES,
  POSITIONS,
  allCombinationSlugs,
  arcanumHref,
  chakraHref,
  hasHubRoute,
  hubHref,
  karmicTailHref,
  positionHref,
  yearHref,
} from "@/lib/encyclopedia";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

// Одна карта сайта на всё: энциклопедия, категории статей и статика. Страницы матриц
// (5 544 адреса вида 1-1-1990) в карту не входят и закрыты noindex: это массив почти-дублей
// одной формы, он тянул домен вниз. Они остаются как результат расчёта и узел перелинковки.
// Приватные адреса (/report, /account, /matrices, /pay) в карту не входят: они закрыты
// в robots.txt и печатаются на запрос.
// Боевой адрес: с любого другого контура карта сайта не отдаётся вовсе. Иначе тест, закрытый и
// robots.txt, и паролем, сам сдавал бы поиску полный список своих адресов.
const PRODUCTION = "https://arcana-sense.ru";

export default function sitemap(): MetadataRoute.Sitemap {
  if (SITE.url !== PRODUCTION) return [];
  const abs = (path: string) => new URL(path, SITE.url).toString();
  const now = new Date();

  return [
    { url: abs("/"), lastModified: now, priority: 1 },
    { url: abs("/encyclopedia"), lastModified: now, priority: 0.9 },
    ...ARCANA.map((a) => ({ url: abs(arcanumHref(a.n)), lastModified: now, priority: 0.8 })),
    ...POSITIONS.map((p) => ({ url: abs(positionHref(p.key)), lastModified: now, priority: 0.7 })),
    ...CHAKRA_PAGES.map((c) => ({ url: abs(chakraHref(c.key)), lastModified: now, priority: 0.6 })),
    ...allCombinationSlugs().map((s) => ({
      url: abs(`/encyclopedia/combination/${s}`),
      lastModified: now,
      priority: 0.5,
    })),
    { url: abs("/matrix"), lastModified: now, priority: 0.6 },
    // категории статей: в карту попадает только то, для чего есть написанный контент
    // шапки категорий в карте всегда: у них собственный текст, он не зависит от того, написаны
    // ли статьи внутри. По наличию статей строятся только сами статьи и корневые хабы.
    { url: abs(KARMIC_TAIL_HUB), lastModified: now, priority: 0.8 },
    ...karmicTailKeys().map((key) => ({
      url: abs(karmicTailHref(key)),
      lastModified: now,
      priority: 0.7,
    })),
    { url: abs(YEAR_HUB), lastModified: now, priority: 0.8 },
    ...yearKeys().map((key) => ({ url: abs(yearHref(key)), lastModified: now, priority: 0.7 })),
    ...hubKeys()
      .filter(hasHubRoute)
      .map((key) => ({ url: abs(hubHref(key)), lastModified: now, priority: 0.8 })),
    { url: abs("/contacts"), lastModified: now, priority: 0.3 },
    { url: abs("/oferta"), lastModified: now, priority: 0.3 },
    { url: abs("/privacy"), lastModified: now, priority: 0.3 },
    { url: abs("/refund"), lastModified: now, priority: 0.3 },
  ];
}
