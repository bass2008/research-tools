import type { Metadata } from "next";

import { D, L, LANGS, SITE_HOSTS } from "./i18n";
import type { Lang } from "./i18n/lang";
import { langsOfPath } from "./servicePages";
import { publicSettings } from "./settings/public";

// Поддержка в Telegram: бот не может написать первым, поэтому публичен адрес бота, а не чат
// (docs/support-bot.md). Токен и идентификатор группы живут вне репозитория.
export const SUPPORT_BOT = "ArcanaSenseSupportBot";

export const SITE = {
  // Бренд — Arcana Sense; «матрица судьбы» остаётся товарным словом в заголовках и текстах:
  // это поисковый запрос, ради которого страницы и написаны, из SEO его убирать нельзя.
  name: "Arcana Sense",
  short: "Arcana Sense",
  url: publicSettings.get("siteUrl"),
  ogImage: "/og.png",
  ogWidth: 1200,
  ogHeight: 630,
};

// Реквизиты приходят от владельца перед запуском; до этого — заглушки в угловых скобках.
// Их видно и в футере, и в юридических страницах: так проверка «на странице нет заглушек»
// падает громко, а не молча выпускает сайт в продакшн.
//
// У каждого домена свой продавец: на `.ru` работает ИП, у `.com` продавец ещё не выбран
// (`docs/foreign-acquiring.md`), и там обязателен не реквизит, а честная заглушка.
interface Legal {
  entity: string;
  inn: string;
  ogrnip: string;
  email: string;
  site: string;
  phone: string;
  rknNotice: string;
  updated: string;
  bank: string;
  hosting: string;
  mailer: string;
}

const LEGAL_BY_LANG: Record<Lang, Legal> = {
  ru: {
    entity: "ИП Бородаенко С.Н.",
    inn: "311602909801",
    ogrnip: "324310000047302",
    // адреса нет намеренно: у ИП в ЕГРИП стоит место жительства, публиковать его не нужно —
    // обязанности такой нет, а связь идёт через почту
    // почта на .com и у русского сайта: форвардер бесплатно обслуживает один домен
    email: "hello@arcana-sense.com",
    site: "arcana-sense.ru",
    // телефон печатается только на «Контактах» — там его требует эквайрер; пусто = строки нет
    phone: "",
    rknNotice: "",
    updated: "20 сентября 2026",
    bank: "Т-Банк",
    // имена обработчиков не раскрываем: закон требует факт передачи и цель, а не поимённый список.
    // Названы только те, кого покупатель видит сам, — платёжный провайдер и Метрика.
    hosting: "провайдер облачной инфраструктуры (Россия)",
    mailer: "сервис отправки транзакционных писем",
  },
  en: {
    // Владелец сайта назван именем сервиса, и этого довольно: регистрационный номер спрашивают
    // у продавца, а продаж за пределами России нет. Пустое поле означает «строки нет» — места,
    // где оно печаталось, его не показывают.
    entity: "Arcana Sense",
    inn: "",
    ogrnip: "",
    email: "hello@arcana-sense.com",
    site: "arcana-sense.com",
    phone: "",
    rknNotice: "",
    updated: "20 September 2026",
    // Касса не подключена: называть платёжного провайдера нечем, и данные к нему не уходят.
    bank: "",
    hosting: "a cloud infrastructure provider",
    mailer: "a transactional email service",
  },
};

export const LEGAL: Legal = LEGAL_BY_LANG[L];

export const DISCLAIMER = D.meta.disclaimer[L];

// Шаблон в корневом layout дописывает « — Arcana Sense» к каждому заголовку, и статья, написанная
// под верхнюю границу B1 (~70 знаков), выходила за неё вместе с суффиксом: у хвоста 63 знака своих
// превращались в 78. Длинный заголовок печатается без бренда — обрезка в выдаче съела бы как раз
// его, а не имя сайта.
const TITLE_LIMIT = 70;
const SUFFIX = ` — ${SITE.short}`;

function titleOf(title: string): string | { absolute: string } {
  return title.length + SUFFIX.length > TITLE_LIMIT ? { absolute: title } : title;
}

/** Адреса той же страницы на других языках: хост меняется, путь остаётся. */
function alternates(path: string): Record<string, string> {
  // Служебная страница живёт не на всех языках: заявить её версию там, где маршрут отвечает
  // 404, значит послать поиск в никуда. Для остальных адресов набор языков общий.
  const langs = langsOfPath(path) ?? LANGS;
  const pairs = langs.map((lang) => [lang, new URL(path, SITE_HOSTS[lang]).toString()] as const);
  const fallback = langs.includes("en") ? SITE_HOSTS.en : SITE_HOSTS[langs[0]];
  return {
    ...Object.fromEntries(pairs),
    "x-default": new URL(path, fallback).toString(),
  };
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
    // Связка языковых версий взаимная и страница-в-страницу (`docs/eng-ver.md` §2): путь один
    // на оба домена, поэтому адрес пары вычисляется, а не хранится. `x-default` — английская.
    // Приватные и служебные адреса пары не имеют: там `noindex`, и связывать нечего.
    alternates: opts.noindex ? { canonical: url } : { canonical: url, languages: alternates(opts.path) },
    // приватные страницы закрыты целиком; noindex + follow нужен там, где страница из индекса
    // ушла, а её ссылки на арканы и позиции должны продолжать работать
    robots: opts.noindex ? { index: false, follow: opts.follow === true } : undefined,
    openGraph: {
      type: opts.article ? "article" : "website",
      siteName: SITE.name,
      locale: D.meta.ogLocale[L],
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
