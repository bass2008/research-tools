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
  updated: "29 августа 2026",
  bank: "Т-Банк",
  // имена обработчиков не раскрываем: закон требует факт передачи и цель, а не поимённый список.
  // Названы только те, кого покупатель видит сам, — платёжный провайдер и Метрика.
  hosting: "провайдер облачной инфраструктуры (Россия)",
  mailer: "сервис отправки транзакционных писем",
};

export const DISCLAIMER =
  "Расчёт носит информационно-развлекательный характер, не является медицинской, " +
  "психологической или финансовой консультацией и не гарантирует наступления событий.";

// Шаблон в корневом layout дописывает « — Arcana Sense» к каждому заголовку, и статья, написанная
// под верхнюю границу B1 (~70 знаков), выходила за неё вместе с суффиксом: у хвоста 63 знака своих
// превращались в 78. Длинный заголовок печатается без бренда — обрезка в выдаче съела бы как раз
// его, а не имя сайта.
const TITLE_LIMIT = 70;
const SUFFIX = ` — ${SITE.short}`;

function titleOf(title: string): string | { absolute: string } {
  return title.length + SUFFIX.length > TITLE_LIMIT ? { absolute: title } : title;
}

export function pageMeta(opts: {
  title: string;
  description: string;
  path: string;
  /** страница отдаёт schema.org Article — og:type должен совпадать, иначе соцсети и поиск
      получают разные утверждения об одном и том же документе */
  article?: boolean;
  noindex?: boolean;
  /** Оставить обход ссылок при noindex: страница уходит из индекса, но перелинковка живёт. */
  follow?: boolean;
}): Metadata {
  const url = new URL(opts.path, SITE.url).toString();
  return {
    title: titleOf(opts.title),
    description: opts.description,
    alternates: { canonical: url },
    // приватные страницы закрыты целиком; noindex + follow нужен там, где страница из индекса
    // ушла, а её ссылки на арканы и позиции должны продолжать работать
    robots: opts.noindex ? { index: false, follow: opts.follow === true } : undefined,
    openGraph: {
      type: opts.article ? "article" : "website",
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

/** Адрес для печати: PDF открывается по внутреннему http://web:3000, и относительная ссылка
 *  внутри файла у покупателя никуда не ведёт. */
export function publicHref(path: string): string {
  return new URL(path, SITE.url).toString();
}
