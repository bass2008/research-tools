import type { MetadataRoute } from "next";

import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedPositionArcanum } from "@/lib/positionArcanum";
import { forLocale as localizedServicePages } from "@/lib/servicePages";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { DEFAULT_SITE, type SiteProfile } from "./siteProfile";

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


export function sitemapForSite(site: SiteProfile = DEFAULT_SITE): MetadataRoute.Sitemap {
  if (!site.indexable) return [];
  const L = site.defaultLocale;
  const { ARCANA } = localizedArcana(L);
  const { hubKeys, indexedKarmicTailKeys, yearKeys } = localizedContent(L);
  const { indexedRegistryItems, positionArcanumHref } = localizedPositionArcanum(L);
  const { SERVICE_PAGES, servicePages } = localizedServicePages(L);
  const { ARCANUM_HUB, CHAKRA_HUB, COMBINATION_HUB, KARMIC_TAIL_HUB, POSITION_HUB, YEAR_HUB, CHAKRA_PAGES, POSITIONS, allCombinationSlugs, arcanumHref, chakraHref, hasHubRoute, hubHref, karmicTailHref, positionHref, yearHref, } = localizedEncyclopedia(L);

  const abs = (path: string) => new URL(path, site.origin).toString();
  // `lastmod` в карте нет намеренно. Честная дата у нас была бы только постраничной, а общая
  // дата корпуса стояла на всех 444 адресах сразу: при правке одной статьи карта заявляла, что
  // изменились все. Google учитывает `lastmod`, лишь пока тот «consistently and verifiably
  // accurate», и перестаёт верить сайту целиком, если это не так; в справке Яндекса про этот
  // элемент не сказано ничего. Пустое поле честнее неверного: робот решает сам.

  // Один адрес — одна запись. Источников у карты несколько (хабы, реестр служебных страниц,
  // разделы), и «О методе» попал в неё дважды: он одновременно хаб и служебная страница.
  // Дубль в карте — сигнал поиску, что сайт сам не знает своих адресов.
  return unique([
    { url: abs("/"), priority: 1 },
    { url: abs("/encyclopedia"), priority: 0.9 },
    // Шапки разделов: у каждой свой текст и свой головной запрос. Приоритет выше листьев —
    // это цель обхода, с которой раздаётся весь раздел.
    ...[ARCANUM_HUB, POSITION_HUB, CHAKRA_HUB, COMBINATION_HUB].map((url) => ({
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
    ...allCombinationSlugs().map((s) => ({
      url: abs(`/encyclopedia/combination/${s}`),

      priority: 0.5,
    })),
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
    ...hubKeys()
      .filter(hasHubRoute)
      .map((key) => ({ url: abs(hubHref(key)), priority: 0.8 })),
    // Служебные страницы берутся из реестра: на языке, где страницы нет, её не должно быть и в
    // карте — иначе поиск идёт по адресу, который отвечает 404.
    ...servicePages().map((key) => ({
      url: abs(SERVICE_PAGES[key].path),
      priority: SERVICE_PAGES[key].priority,
    })),
  ]);
}

function unique(rows: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.url) ? false : seen.add(row.url) && true));
}
