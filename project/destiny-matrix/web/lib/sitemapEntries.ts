import type { MetadataRoute } from "next";

import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedPositionArcanum } from "@/lib/positionArcanum";
import { forLocale as localizedServicePages } from "@/lib/servicePages";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { DEFAULT_SITE, type SiteProfile } from "./siteProfile";
import { buildSettings } from "./settings/build";
import { ENERGY_FIELD_HREF } from "./readingTypes";
import { publicUrl } from "./publicRouting";

// По решению владельца от 27.09.2026 все адреса снова получают общую дату релиза, как до
// 6abed77 (30.08). Тогда карта была статической и new Date() фиксировалась при сборке.
// Теперь карта зависит от Host: берём уже вшитую метку сборки, а не время каждого запроса.
// Без метки (локальный запуск) фиксируем время один раз при загрузке модуля.
const RELEASE_MODIFIED = buildSettings.get("buildIso") || new Date().toISOString();

// Одна карта сайта на всё: энциклопедия, категории статей и статика.
// Приватные адреса (/report, /account, /matrices, /pay) в карту не входят: они закрыты
// в robots.txt и печатаются на запрос.
// Боевой адрес: с любого другого контура карта сайта не отдаётся вовсе. Иначе тест, закрытый и
// robots.txt, и паролем, сам сдавал бы поиску полный список своих адресов.


export function sitemapForSite(site: SiteProfile = DEFAULT_SITE): MetadataRoute.Sitemap {
  if (!site.indexable) return [];
  const L = site.defaultLocale;
  const { ARCANA } = localizedArcana(L);
  const { categoryHub, compatibilityKeys, hubKeys, indexedKarmicTailKeys, indexedPairTailKeys, yearKeys } = localizedContent(L);
  const { indexedRegistryItems, positionArcanumHref } = localizedPositionArcanum(L);
  const { SERVICE_PAGES, servicePages } = localizedServicePages(L);
  const { ARCANUM_HUB, CHAKRA_HUB, COMPATIBILITY_HUB, KARMIC_TAIL_HUB, PAIR_TAIL_HUB, POSITION_HUB, YEAR_HUB, CHAKRA_PAGES, POSITIONS, arcanumHref, chakraHref, compatibilityHref, hasHubRoute, hubHref, karmicTailHref, pairTailHref, positionHref, yearHref, } = localizedEncyclopedia(L);

  const abs = (path: string) => publicUrl(path, site);
  // Один адрес — одна запись. Источников у карты несколько (хабы, реестр служебных страниц,
  // разделы), и «О методе» попал в неё дважды: он одновременно хаб и служебная страница.
  // Дубль в карте — сигнал поиску, что сайт сам не знает своих адресов.
  return unique([
    { url: abs("/"), priority: 1 },
    { url: abs("/encyclopedia"), priority: 0.9 },
    // Шапки разделов: у каждой свой текст и свой головной запрос. Приоритет выше листьев —
    // это цель обхода, с которой раздаётся весь раздел.
    ...[ARCANUM_HUB, POSITION_HUB, CHAKRA_HUB].map((url) => ({
      url: abs(url),

      priority: 0.85,
    })),
    ...ARCANA.map((a) => ({ url: abs(arcanumHref(a.n)), priority: 0.8 })),
    ...POSITIONS.map((p) => ({ url: abs(positionHref(p.key)), priority: 0.7 })),
    // Пересечения «аркан N в позиции X»: адрес совпадает с формой запроса, и это единственная
    // форма, которая на этом сайте берёт позиции — раздел сочетаний стоит на медиане 5, а
    // каталоги позиций на 33–42. В карту идут только записи со спросом: остальные существуют
    // ради продукта и закрыты noindex.
    ...indexedRegistryItems().map((item) => ({
      url: abs(positionArcanumHref(item.position, item.arcanum)),

      priority: 0.75,
    })),
    ...CHAKRA_PAGES.map((c) => ({ url: abs(chakraHref(c.key)), priority: 0.6 })),
    ...(categoryHub("energy-field") ? [{ url: abs(ENERGY_FIELD_HREF), priority: 0.6 }] : []),
    // категории статей: в карту попадает только то, для чего есть написанный контент
    // шапки категорий в карте всегда: у них собственный текст, он не зависит от того, написаны
    // ли статьи внутри. По наличию статей строятся только сами статьи и корневые хабы.
    { url: abs(KARMIC_TAIL_HUB), priority: 0.8 },
    ...indexedKarmicTailKeys().map((key) => ({
      url: abs(karmicTailHref(key)),

      priority: 0.7,
    })),
    { url: abs(YEAR_HUB), priority: 0.8 },
    ...yearKeys().map((key) => ({ url: abs(yearHref(key)), priority: 0.7 })),
    ...(categoryHub("compatibility") ? [{ url: abs(COMPATIBILITY_HUB), priority: 0.8 }] : []),
    ...compatibilityKeys().map((n) => ({ url: abs(compatibilityHref(n)), priority: 0.7 })),
    ...(indexedPairTailKeys().length ? [{ url: abs(PAIR_TAIL_HUB), priority: 0.8 }] : []),
    ...indexedPairTailKeys().map((key) => ({ url: abs(pairTailHref(key)), priority: 0.7 })),
    ...hubKeys()
      .filter(hasHubRoute)
      .map((key) => ({ url: abs(hubHref(key)), priority: 0.8 })),
    // Служебные страницы берутся из реестра: на языке, где страницы нет, её не должно быть и в
    // карте — иначе поиск идёт по адресу, который отвечает 404.
    ...servicePages().map((key) => ({
      url: abs(SERVICE_PAGES[key].path),
      priority: SERVICE_PAGES[key].priority,
    })),
    { url: abs("/compatibility"), priority: 0.9 },
  ]).map((entry) => ({ ...entry, lastModified: RELEASE_MODIFIED }));
}

function unique(rows: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.url) ? false : seen.add(row.url) && true));
}
