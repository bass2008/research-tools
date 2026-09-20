"use client";

import { usePathname } from "next/navigation";

import { D, L, LANGS, SITE_HOSTS } from "@/lib/i18n";

/**
 * Ссылка на ту же страницу другой языковой версии. Версии живут на разных доменах, путь у них
 * общий (`docs/eng-ver.md` §2), поэтому адрес считается, а не хранится.
 *
 * Клиентский компонент ради `usePathname`: подвал печатается на 5 544 статических страницах, и
 * передавать путь пропом в каждую значило бы менять сигнатуру всего дерева.
 */
export default function LanguageLink() {
  const path = usePathname() || "/";
  const other = LANGS.find((lang) => lang !== L);
  if (!other) return null;
  return (
    <a href={`${SITE_HOSTS[other]}${path}`} hrefLang={other} rel="alternate">
      {D.nav.otherLanguage[other]}
    </a>
  );
}
