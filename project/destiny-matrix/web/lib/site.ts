import type { Metadata } from "next";

export const SITE = {
  name: "Матрица судьбы",
  short: "Матрица судьбы",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://matritsa.webstudiolab.ru",
  ogImage: "/og.png",
  ogWidth: 1200,
  ogHeight: 630,
};

// Реквизиты приходят от владельца перед запуском; до этого — заглушки в угловых скобках.
// Их видно и в футере, и в юридических страницах: так проверка «на странице нет заглушек»
// падает громко, а не молча выпускает сайт в продакшн.
export const LEGAL = {
  entity: "⟨ИП Фамилия И. О.⟩",
  inn: "⟨ИНН⟩",
  ogrnip: "⟨ОГРНИП⟩",
  address: "⟨адрес регистрации⟩",
  email: "⟨почта для обращений⟩",
  site: "⟨адрес сайта⟩",
  phone: "⟨телефон⟩",
  rknNotice: "⟨дата и номер уведомления РКН⟩",
  updated: "⟨дата публикации⟩",
  bank: "⟨платёжный провайдер⟩",
};

export const DISCLAIMER =
  "Расчёт носит информационно-развлекательный характер, не является медицинской, " +
  "психологической или финансовой консультацией и не гарантирует наступления событий.";

export function pageMeta(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const url = new URL(opts.path, SITE.url).toString();
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    robots: opts.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "ru_RU",
      title: opts.title,
      description: opts.description,
      url,
      images: [{ url: SITE.ogImage, width: SITE.ogWidth, height: SITE.ogHeight, alt: SITE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [SITE.ogImage],
    },
  };
}
