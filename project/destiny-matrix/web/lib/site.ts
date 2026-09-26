import { forLocale as formats } from "./i18n/format";
import type { Metadata } from "next";
import { D, LANGS, SITE_HOSTS } from "./i18n";
import type { Lang } from "./i18n/lang";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import { forLocale as localizedServicePages } from "./servicePages";

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

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale, site) => {
  const { langsOfPath } = localizedServicePages(L);

  // Поддержка в Telegram: бот не может написать первым, поэтому публичен адрес бота, а не чат
  // (docs/support-bot.md). Токен и идентификатор группы живут вне репозитория.
  const SUPPORT_BOT = "ArcanaSenseSupportBot";

  const SITE = {
    // Бренд — Arcana Sense; «матрица судьбы» остаётся товарным словом в заголовках и текстах:
    // это поисковый запрос, ради которого страницы и написаны, из SEO его убирать нельзя.
    name: "Arcana Sense",
    short: "Arcana Sense",
    url: site.origin,
    // Search and link previews follow the public language of the host, even after
    // a visitor switches the interactive interface to another language.
    ogImage: site.defaultLocale === "en" ? "/og-en.png" : "/og.png",
    ogWidth: 1200,
    ogHeight: 630,
  };

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

  const LEGAL: Legal = {
    ...LEGAL_BY_LANG[site.legalLocale],
    updated: formats(L).dateLabel("2026-09-20"),
    hosting: L === "ru"
      ? `провайдер облачной инфраструктуры${site.legalLocale === "ru" ? " (Россия)" : ""}`
      : `a cloud infrastructure provider${site.legalLocale === "ru" ? " (Russia)" : ""}`,
    mailer: L === "ru" ? "сервис отправки транзакционных писем" : "a transactional email service",
  };

  const DISCLAIMER = D.meta.disclaimer[L];

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

  function pageMeta(opts: {
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
      // Связка языковых версий взаимная и страница-в-страницу (`docs/runtime-localization.md`, «Публичный HTML и выбор посетителя»): путь один
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
  function publicHref(path: string): string {
    return new URL(path, SITE.url).toString();
  }
  return { SUPPORT_BOT, SITE, LEGAL, DISCLAIMER, pageMeta, publicHref };
});

// Compatibility for callers that explicitly use the deployment default.
export const { SUPPORT_BOT, SITE, LEGAL, DISCLAIMER, pageMeta, publicHref } = forLocale(defaultLocale);
