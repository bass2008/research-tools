import type { Metadata } from "next";

export const SITE = {
  // Бренд — Arcana Sense; «матрица судьбы» остаётся товарным словом в заголовках и текстах:
  // это поисковый запрос, ради которого страницы и написаны, из SEO его убирать нельзя.
  name: "Arcana Sense",
  short: "Arcana Sense",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://arcana-sense.ru",
  ogImage: "/og.png",
  ogWidth: 1200,
  ogHeight: 630,
};

// Реквизиты приходят от владельца перед запуском; до этого — заглушки в угловых скобках.
// Их видно и в футере, и в юридических страницах: так проверка «на странице нет заглушек»
// падает громко, а не молча выпускает сайт в продакшн.
export const LEGAL = {
  entity: "ИП Бородаенко С.Н.",
  inn: "311602909801",
  ogrnip: "324310000047302",
  // адреса нет намеренно: у ИП в ЕГРИП стоит место жительства, публиковать его не нужно —
  // обязанности такой нет, а связь идёт через почту
  email: "hello@arcana-sense.ru",
  site: "arcana-sense.ru",
  // телефон печатается только на «Контактах» — там его требует эквайрер; пусто = строки нет
  phone: "",
  rknNotice: "",
  updated: "22 августа 2026",
  bank: "Т-Банк",
  // имена обработчиков не раскрываем: закон требует факт передачи и цель, а не поимённый список.
  // Названы только те, кого покупатель видит сам, — платёжный провайдер и Метрика.
  hosting: "провайдер облачной инфраструктуры (Россия)",
  mailer: "сервис отправки транзакционных писем",
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
