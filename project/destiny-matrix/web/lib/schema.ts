import { CONTENT_PUBLISHED } from "./corpusDates";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import { forLocale as localizedSite } from "./site";

// Дата публикации живёт в `lib/corpusDates` и отсюда переизлучается: её импортируют как часть
// разметки. Article без author/datePublished/publisher Google отбраковывает целиком, поэтому она
// стоит константой. Даты правки у сайта нет вовсе — ни в разметке, ни в карте сайта.
export { CONTENT_PUBLISHED };

export interface Crumb {
  name: string;
  path?: string;
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale, site) => {
  const { LEGAL, SITE } = localizedSite(L, site);

  const abs = (path: string) => new URL(path, SITE.url).toString();

  const AUTHOR = { "@type": "Organization", name: SITE.name, url: SITE.url };

  const PUBLISHER = {
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    legalName: LEGAL.entity,
    // Номер печатается только там, где он есть: пустой `taxID` в разметке — заявление о том,
    // чего нет.
    ...(LEGAL.inn ? { taxID: LEGAL.inn } : {}),
    email: `mailto:${LEGAL.email}`,
    logo: { "@type": "ImageObject", url: abs(SITE.ogImage) },
  };

  function breadcrumbLd(crumbs: Crumb[]) {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        // у последней крошки item нет: она и есть текущая страница
        ...(c.path ? { item: abs(c.path) } : {}),
      })),
    };
  }

  function articleLd(opts: {
    headline: string;
    description: string;
    path: string;
    image?: string;
    keywords?: string[];
    published?: string;
    modified?: string;
  }) {
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: opts.headline,
      description: opts.description,
      inLanguage: L,
      author: AUTHOR,
      publisher: PUBLISHER,
      datePublished: opts.published ?? CONTENT_PUBLISHED,
      // Дата правки печатается, только если страница знает свою. Общей датой корпуса её заполнять
      // нельзя: она вшита в разметку всех 442 страниц, а процесс требует сдвигать её при правке
      // любой статьи — тело менялось у каждой, и поиск перекачивал корпус из-за одной статьи.
      ...(opts.modified ? { dateModified: opts.modified } : {}),
      ...(opts.keywords?.length ? { keywords: opts.keywords.join(", ") } : {}),
      ...(opts.image ? { image: abs(opts.image) } : {}),
      mainEntityOfPage: { "@type": "WebPage", "@id": abs(opts.path) },
    };
  }

  function faqLd(faq: Array<{ q: string; a: string }>) {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    };
  }

  function itemListLd(opts: { name: string; items: Array<{ name: string; path: string }> }) {
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: opts.name,
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        url: abs(it.path),
      })),
    };
  }
  return { CONTENT_PUBLISHED, breadcrumbLd, articleLd, faqLd, itemListLd };
});

// Compatibility for callers that explicitly use the deployment default.
export const { breadcrumbLd, articleLd, faqLd, itemListLd } = forLocale(defaultLocale);
