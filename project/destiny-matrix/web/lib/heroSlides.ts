import { forLocale as localizedEncyclopediaNavigation } from "./encyclopediaNavigation";
import { D } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";

export interface HeroSlide {
  eyebrow: string;
  heading: string;
  /** вторая кнопка ведёт туда, о чём слайд; первая (покупка) одна на все слайды */
  link: { label: string; href: string };
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const { encyclopediaSectionHref } = localizedEncyclopediaNavigation(L);

  // Тексты слайдов живут в словаре языка, адреса — здесь: путь у всех языков один.
  const LANDING_HREFS = [
    "/#plans",
    encyclopediaSectionHref("pts"),
    encyclopediaSectionHref("arc"),
    "/year",
    "/matrix",
  ];

  const ENCYCLOPEDIA_HREFS = [
    "/#plans",
    encyclopediaSectionHref("pts"),
    encyclopediaSectionHref("arc"),
    "/year",
    encyclopediaSectionHref("sec"),
  ];

  function slides(rows: typeof D.slides.landing, hrefs: string[]): HeroSlide[] {
    return rows.map((row, index) => ({
      eyebrow: row.eyebrow[L],
      heading: row.heading[L],
      link: { label: row.link[L], href: hrefs[index] },
    }));
  }

  // Порядок совпадает с порядком композиций в CalcHero: веер, кольцо, триптих, лента, мозаика.
  const LANDING_SLIDES: HeroSlide[] = slides(D.slides.landing, LANDING_HREFS);

  const ENCYCLOPEDIA_SLIDES: HeroSlide[] = slides(D.slides.encyclopedia, ENCYCLOPEDIA_HREFS);
  return { LANDING_SLIDES, ENCYCLOPEDIA_SLIDES };
});

// Compatibility for callers that explicitly use the deployment default.
export const { LANDING_SLIDES, ENCYCLOPEDIA_SLIDES } = forLocale(defaultLocale);
