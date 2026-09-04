import type { MetadataRoute } from "next";

import { ARCANA } from "@/lib/arcana";
import { hubKeys, indexedKarmicTailKeys, yearKeys } from "@/lib/content";
import { positionArcanumHref, registryItems } from "@/lib/positionArcanum";
import {
  ARCANUM_HUB,
  CHAKRA_HUB,
  COMBINATION_HUB,
  KARMIC_TAIL_HUB,
  POSITION_HUB,
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
import { CONTENT_MODIFIED } from "@/lib/schema";

export const dynamic = "force-static";

// Одна карта сайта на всё: энциклопедия, категории статей и статика. Страницы матриц
// (5 544 адреса вида 1-1-1990) в карту не входят и закрыты noindex: это массив почти-дублей
// одной формы, он тянул домен вниз. Они остаются как результат расчёта и узел перелинковки.
// Их каталог `/matrix` из карты тоже убран: спроса на список всех матриц нет (ноль показов за
// первые дни индексации при наличии в карте), а его содержимое — ссылки на адреса, закрытые от
// обхода. Сама страница живёт и остаётся путём человека к конкретной карте.
// Приватные адреса (/report, /account, /matrices, /pay) в карту не входят: они закрыты
// в robots.txt и печатаются на запрос.
// Боевой адрес: с любого другого контура карта сайта не отдаётся вовсе. Иначе тест, закрытый и
// robots.txt, и паролем, сам сдавал бы поиску полный список своих адресов.
const PRODUCTION = "https://arcana-sense.ru";

export default function sitemap(): MetadataRoute.Sitemap {
  if (SITE.url !== PRODUCTION) return [];
  const abs = (path: string) => new URL(path, SITE.url).toString();
  // Дата отражает последнюю смысловую правку корпуса. `new Date()` на каждой сборке говорил
  // поисковику, будто все сотни статей изменились одновременно, хотя менялся только image tag.
  const modified = new Date(`${CONTENT_MODIFIED}T00:00:00Z`);

  return [
    { url: abs("/"), lastModified: modified, priority: 1 },
    { url: abs("/encyclopedia"), lastModified: modified, priority: 0.9 },
    // Шапки разделов: у каждой свой текст и свой головной запрос. Приоритет выше листьев —
    // это цель обхода, с которой раздаётся весь раздел.
    ...[ARCANUM_HUB, POSITION_HUB, CHAKRA_HUB, COMBINATION_HUB].map((url) => ({
      url: abs(url),
      lastModified: modified,
      priority: 0.85,
    })),
    ...ARCANA.map((a) => ({ url: abs(arcanumHref(a.n)), lastModified: modified, priority: 0.8 })),
    ...POSITIONS.map((p) => ({ url: abs(positionHref(p.key)), lastModified: modified, priority: 0.7 })),
    // Пересечения «аркан N в позиции X»: адрес совпадает с формой запроса, и это единственная
    // форма, которая на этом сайте берёт позиции — раздел сочетаний стоит на медиане 5, а
    // каталоги позиций на 33–42. Набор задан реестром спроса, а не перебором 22 × 37.
    ...registryItems().map((item) => ({
      url: abs(positionArcanumHref(item.position, item.arcanum)),
      lastModified: modified,
      priority: 0.75,
    })),
    ...CHAKRA_PAGES.map((c) => ({ url: abs(chakraHref(c.key)), lastModified: modified, priority: 0.6 })),
    ...allCombinationSlugs().map((s) => ({
      url: abs(`/encyclopedia/combination/${s}`),
      lastModified: modified,
      priority: 0.5,
    })),
    // категории статей: в карту попадает только то, для чего есть написанный контент
    // шапки категорий в карте всегда: у них собственный текст, он не зависит от того, написаны
    // ли статьи внутри. По наличию статей строятся только сами статьи и корневые хабы.
    { url: abs(KARMIC_TAIL_HUB), lastModified: modified, priority: 0.8 },
    ...indexedKarmicTailKeys().map((key) => ({
      url: abs(karmicTailHref(key)),
      lastModified: modified,
      priority: 0.7,
    })),
    { url: abs(YEAR_HUB), lastModified: modified, priority: 0.8 },
    ...yearKeys().map((key) => ({ url: abs(yearHref(key)), lastModified: modified, priority: 0.7 })),
    ...hubKeys()
      .filter(hasHubRoute)
      .map((key) => ({ url: abs(hubHref(key)), lastModified: modified, priority: 0.8 })),
    { url: abs("/contacts"), lastModified: modified, priority: 0.3 },
    { url: abs("/oferta"), lastModified: modified, priority: 0.3 },
    { url: abs("/privacy"), lastModified: modified, priority: 0.3 },
    { url: abs("/refund"), lastModified: modified, priority: 0.3 },
  ];
}
