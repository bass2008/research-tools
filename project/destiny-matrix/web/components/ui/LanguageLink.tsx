"use client";

import { D, L, LANGS, SITE_HOSTS } from "@/lib/i18n";

/**
 * Ссылка на другую языковую версию — всегда её главная.
 *
 * Путь не переносится: у страниц оплаты пары не существует (кассы за пределами России нет), и
 * ссылка уводила покупателя с формы оплаты на `arcana-sense.com/pay`, которого нет. Главная
 * работает для любой страницы, с которой её нажали.
 */
export default function LanguageLink() {
  const other = LANGS.find((lang) => lang !== L);
  if (!other) return null;
  return (
    <a href={SITE_HOSTS[other]} hrefLang={other} rel="alternate">
      {D.nav.otherLanguage[other]}
    </a>
  );
}
