import { L, type Lang } from "./i18n";

// Служебные страницы сайта: о методе, об авторе, контакты и правовые документы. Раньше набор
// был записан трижды — в маршруте, в подвале и в карте сайта, — и они разъехались: подвал вёл
// на страницу, которой на этом языке нет, а карта сайта обещала её адрес поиску.
//
// Здесь набор задан один раз. Маршрут, подвал, карта сайта и hreflang читают его и ничего не
// знают друг о друге; чтобы убрать или добавить страницу языку, правится одна строка.

export type ServiceKey =
  | "method"
  | "author"
  | "contacts"
  | "support"
  | "terms"
  | "privacy"
  | "refund";

/** Группа подвала: о сервисе или правовые документы. */
export type ServiceGroup = "about" | "legal";

interface ServicePage {
  path: string;
  /** Языки, на которых страница существует. На остальных её маршрут отвечает 404. */
  langs: readonly Lang[];
  group: ServiceGroup;
  /** Ключ подписи в словаре `D.nav`. */
  nav: "about" | "author" | "contacts" | "support" | "terms" | "privacy" | "refund";
  /** Приоритет в карте сайта. */
  priority: number;
}

export const SERVICE_PAGES: Record<ServiceKey, ServicePage> = {
  method: { path: "/method", langs: ["ru", "en"], group: "about", nav: "about", priority: 0.6 },
  author: { path: "/author", langs: ["ru", "en"], group: "about", nav: "author", priority: 0.4 },
  contacts: { path: "/contacts", langs: ["ru", "en"], group: "about", nav: "contacts", priority: 0.3 },
  support: { path: "/support", langs: ["ru", "en"], group: "about", nav: "support", priority: 0.3 },
  terms: { path: "/terms", langs: ["ru", "en"], group: "legal", nav: "terms", priority: 0.3 },
  privacy: { path: "/privacy", langs: ["ru", "en"], group: "legal", nav: "privacy", priority: 0.3 },
  // Возврат есть на обоих языках и при выключенной кассе: он описывает не витрину, а уже
  // прошедшие платежи. Сайт можно сделать бесплатным после того, как оплаты состоялись, —
  // вернуть по ним деньги человек вправе и тогда.
  refund: { path: "/refund", langs: ["ru", "en"], group: "legal", nav: "refund", priority: 0.3 },
};

const KEYS = Object.keys(SERVICE_PAGES) as ServiceKey[];

/** Есть ли страница на языке этой сборки. */
export function hasServicePage(key: ServiceKey, lang: Lang = L): boolean {
  return SERVICE_PAGES[key].langs.includes(lang);
}

/** Ключи группы в порядке объявления — подвал печатает их одним списком. */
export function servicePagesOf(group: ServiceGroup, lang: Lang = L): ServiceKey[] {
  return KEYS.filter((key) => SERVICE_PAGES[key].group === group && hasServicePage(key, lang));
}

/** Все страницы языка: карта сайта берёт адреса отсюда. */
export function servicePages(lang: Lang = L): ServiceKey[] {
  return KEYS.filter((key) => hasServicePage(key, lang));
}

/** Языки, где живёт этот путь. Пустой массив — путь не служебный, языковые версии у него общие. */
export function langsOfPath(path: string): readonly Lang[] | null {
  const key = KEYS.find((k) => SERVICE_PAGES[k].path === path);
  return key ? SERVICE_PAGES[key].langs : null;
}
