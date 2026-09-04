import { LEGAL, SITE } from "./site";

// Дата публикации и правки корпуса. Article без author/datePublished/publisher Google
// отбраковывает целиком, поэтому даты стоят константами: они относятся к контенту, а не к
// сборке, и от прогона к прогону меняться не должны.
export const CONTENT_PUBLISHED = "2026-04-01";
export const CONTENT_MODIFIED = "2026-09-04";

const abs = (path: string) => new URL(path, SITE.url).toString();

const AUTHOR = { "@type": "Organization", name: SITE.name, url: SITE.url };

const PUBLISHER = {
  "@type": "Organization",
  name: SITE.name,
  url: SITE.url,
  legalName: LEGAL.entity,
  taxID: LEGAL.inn,
  email: `mailto:${LEGAL.email}`,
  logo: { "@type": "ImageObject", url: abs(SITE.ogImage) },
};

export interface Crumb {
  name: string;
  path?: string;
}

export function breadcrumbLd(crumbs: Crumb[]) {
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

export function articleLd(opts: {
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
    inLanguage: "ru",
    author: AUTHOR,
    publisher: PUBLISHER,
    datePublished: opts.published ?? CONTENT_PUBLISHED,
    dateModified: opts.modified ?? CONTENT_MODIFIED,
    ...(opts.keywords?.length ? { keywords: opts.keywords.join(", ") } : {}),
    ...(opts.image ? { image: abs(opts.image) } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": abs(opts.path) },
  };
}

export function faqLd(faq: Array<{ q: string; a: string }>) {
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

export function itemListLd(opts: { name: string; items: Array<{ name: string; path: string }> }) {
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
