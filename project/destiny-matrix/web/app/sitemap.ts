import type { MetadataRoute } from "next";

import { ARCANA } from "@/lib/arcana";
import { matrixSlugs } from "@/lib/content";
import {
  CHAKRA_PAGES,
  POSITIONS,
  allCombinationSlugs,
  arcanumHref,
  chakraHref,
  positionHref,
} from "@/lib/encyclopedia";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

// Одна карта сайта на всё: 298 страниц энциклопедии, 5 544 страницы матриц и статика.
// Раньше матрицы жили в отдельном /matrix/sitemap.xml, и его никто не указывал в robots.txt —
// длинный хвост в индекс не попадал. Приватные адреса (/report, /account, /matrices, /pay)
// в карту не входят: они закрыты в robots.txt и печатаются на запрос.
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
    ...matrixSlugs().map((slug) => ({
      url: abs(`/matrix/${slug}`),
      lastModified: now,
      priority: 0.4,
    })),
    { url: abs("/contacts"), lastModified: now, priority: 0.3 },
    { url: abs("/oferta"), lastModified: now, priority: 0.3 },
    { url: abs("/privacy"), lastModified: now, priority: 0.3 },
    { url: abs("/refund"), lastModified: now, priority: 0.3 },
  ];
}
